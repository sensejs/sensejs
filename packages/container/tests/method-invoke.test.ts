import {BindingType, Constructor, Container, Inject, Injectable, Middleware, Next} from '../src/index.js';
import {jest} from '@jest/globals';

class CustomContext<T extends {} = any, K extends keyof T = any> {
  constructor(
    readonly targetConstructor: Constructor<T>,
    readonly targetMethodKey: K,
  ) {}
}

describe('MethodInvoker', () => {
  test('Without middleware', async () => {
    const container = new Container();

    @Injectable()
    class MyComponent {}

    const f = jest.fn();

    @Injectable()
    class MyFoo {
      foo(@Inject(MyComponent) mc: MyComponent) {
        expect(mc).toBeInstanceOf(MyComponent);
        f();
      }
    }

    await container.add(MyComponent).add(MyFoo).createMethodInvoker(MyFoo, 'foo', []).invoke();

    expect(f).toHaveBeenCalled();
  });

  test('With middleware', async () => {
    const container = new Container();

    class MyComponent {}

    const f = jest.fn();

    @Middleware({
      provides: [MyComponent],
    })
    class MyInterceptor {
      async handle(next: Next<[MyComponent]>): Promise<void> {
        f(1);
        // let a: MyComponent = 5;
        await new Promise(setImmediate);
        await next(new MyComponent());
        await new Promise(setImmediate);
        f(3);
      }
    }

    const m: Constructor<Middleware<any[]>> = MyInterceptor;

    @Injectable()
    class MyFoo {
      foo(@Inject(MyComponent) mc: MyComponent) {
        expect(mc).toBeInstanceOf(MyComponent);
        f(2);
        return new Promise(setImmediate);
      }
    }

    await container
      .add(MyInterceptor)
      .add(MyFoo)
      .createMethodInvoker(MyFoo, 'foo', [MyInterceptor], CustomContext)
      .invoke(new CustomContext(MyFoo, 'foo'));

    expect(f).toHaveBeenNthCalledWith(1, 1);
    expect(f).toHaveBeenNthCalledWith(2, 2);
    expect(f).toHaveBeenNthCalledWith(3, 3);
  });

  test('Invoke with middleware multiple times', async () => {
    const container = new Container();

    const f = jest.fn();

    @Middleware()
    class MyInterceptor {
      async handle(next: () => Promise<void>): Promise<void> {
        f();
        await next();
      }
    }
    @Injectable()
    class MyFoo {
      foo() {}
    }
    const mi = container
      .add(MyInterceptor)
      .add(MyFoo)
      .createMethodInvoker(MyFoo, 'foo', [MyInterceptor], CustomContext);

    await mi.invoke(new CustomContext(MyFoo, 'foo'));
    expect(f).toHaveBeenCalledTimes(1);

    await mi.invoke(new CustomContext(MyFoo, 'foo'));
    expect(f).toHaveBeenCalledTimes(2);
  });
});

test('Performance test', async () => {
  const a = Symbol(),
    b = Symbol();

  @Injectable()
  class Test {}

  const container = new Container();
  container.add(Test);
  container.addBinding({
    type: BindingType.CONSTANT,
    id: a,
    value: 'deadbeef',
  });
  container.addBinding({
    type: BindingType.CONSTANT,
    id: b,
    value: 2,
  });
  let constructor: any;
  for (let i = 0; i < 10000; i++) {
    if (i % 100) {
      container.addBinding({
        type: BindingType.CONSTANT,
        id: Symbol(),
        value: i,
      });
      continue;
    }
    if (constructor) {
      @Injectable()
      class X {
        constructor(@Inject(constructor) private empty: any) {}
      }

      container.add(X);
      constructor = X;
    } else {
      @Injectable()
      class X {
        constructor() {}
      }

      container.add(X);
      constructor = X;
    }
  }

  @Injectable()
  class Foo {
    bar(
      @Inject(a, {transform: (x: string) => x.repeat(2)}) param: string,
      @Inject(b, {transform: (x: number) => x * x}) number: number,
      @Inject(Test) test: Test,
      @Inject(constructor) x: any,
    ) {
      return param.repeat(number);
    }
  }

  container.add(Foo);

  let N = 10000;
  // 10000 method invoking should be done within 30s
  let symbol = a;
  const interceptors = Array(100)
    .fill(null)
    .map((value, index) => {
      const deps = symbol;
      symbol = Symbol(`${index}`);

      // Keep using legacy style for coverage
      @Middleware({
        provides: [symbol],
      })
      class Interceptor {
        constructor(@Inject(deps) dep: any, @Inject(CustomContext) context: CustomContext) {}

        async handle(next: (value: any) => Promise<void>): Promise<void> {
          await next(value);
        }
      }

      return Interceptor;
    });

  const methodInvoker = container.createMethodInvoker(Foo, 'bar', interceptors, CustomContext);
  let t = process.hrtime();
  while (N--) {
    await methodInvoker.invoke(new CustomContext(Foo, 'bar'));
  }
  t = process.hrtime(t);
}, 10000);
