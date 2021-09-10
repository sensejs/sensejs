import {AsyncInterceptProvider, BindingType, Constructor, Container, Inject, Injectable} from '../src';
import {InterceptProviderClass} from '../src/method-invoker';

class CustomContext<T extends {} = any, K extends keyof T = any> {
  constructor(readonly targetConstructor: Constructor<T>, readonly targetMethodKey: K) {}
}

describe('MethodInvoker', () => {
  test('Without interceptor', async () => {
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

    await container
      .add(MyComponent)
      .add(MyFoo)
      .createMethodInvoker(
        MyFoo,
        'foo',
        {
          factory: () => new CustomContext(MyFoo, 'foo'),
          paramInjectionMetadata: [],
        },
        [],
      )
      .invoke();

    expect(f).toHaveBeenCalled();
  });

  test('With intercept providers', async () => {
    const container = new Container();

    class MyComponent {}

    const f = jest.fn();

    @InterceptProviderClass(MyComponent)
    class MyInterceptor extends AsyncInterceptProvider<CustomContext, [MyComponent]> {
      async intercept(ctx: CustomContext, next: (value: MyComponent) => Promise<void>): Promise<void> {
        f(1);
        await next(new MyComponent());
        f(3);
      }
    }

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
      .createMethodInvoker(MyFoo, 'foo', {factory: () => new CustomContext(MyFoo, 'foo'), paramInjectionMetadata: []}, [
        MyInterceptor,
      ])
      .invoke();

    expect(f).toHaveBeenNthCalledWith(1, 1);
    expect(f).toHaveBeenNthCalledWith(2, 2);
    expect(f).toHaveBeenNthCalledWith(3, 3);
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

  let N = 50000;
  // 10000 method invoking should be done within 30s
  let symbol = a;
  const interceptors = Array(100)
    .fill(null)
    .map((value) => {
      const deps = symbol;
      symbol = Symbol();
      @InterceptProviderClass(symbol)
      class Interceptor extends AsyncInterceptProvider<CustomContext, any> {
        constructor(@Inject(deps) dep: any) {
          super();
        }
        async intercept(context: CustomContext, next: (value: any) => Promise<void>): Promise<void> {
          await next(value);
        }
      }

      return Interceptor;
    });

  container.compile();

  const methodInvoker = container.createMethodInvoker(
    Foo,
    'bar',
    {
      factory: () => new CustomContext(Foo, 'bar'),
      paramInjectionMetadata: [],
    },
    interceptors,
  );

  const t = process.hrtime();
  while (N--) {
    await methodInvoker.invoke();
  }
  console.log(process.hrtime(t));
}, 10000);
