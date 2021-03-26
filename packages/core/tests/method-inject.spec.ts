import {BindingType, Container, inject, injectable, ResolveContext, ServiceId} from '@sensejs/container';
import {
  Component,
  Constructor,
  invokeMethod,
  MethodInject,
  MethodInvokerBuilder,
  MethodParamDecorateError,
  MethodParamInjectError,
  RequestContext,
  RequestInterceptor,
  validateMethodInjectMetadata,
} from '../src';

describe('@Inject', () => {
  test('param binding', () => {
    const x = Symbol(),
      y = Symbol();

    @injectable()
    class Foo {
      bar(@MethodInject(x) param: string, @MethodInject(y, {transform: (x: number) => x + 1}) number: number) {
        return param.repeat(number);
      }
    }

    const container = new Container();
    const constValue = 'deadbeef';
    container.addBinding({
      type: BindingType.CONSTANT,
      id: x,
      value: constValue,
    });
    container.addBinding({
      type: BindingType.CONSTANT,
      id: y,
      value: 2,
    });
    container.add(Foo);
    expect(invokeMethod(container.createResolveContext(), Foo, 'bar')).toBe(constValue.repeat(3));
  });

  test('Validate param binding', () => {
    const x = Symbol();

    class Foo {
      shouldOkay(@MethodInject(x) foo: any) {}

      shouldFail(foo: any) {}

      noParam() {}
    }

    expect(() => validateMethodInjectMetadata(Foo.prototype, 'shouldOkay')).not.toThrow();
    expect(() => validateMethodInjectMetadata(Foo.prototype, 'shouldFail')).toThrow();
    expect(() => validateMethodInjectMetadata(Foo.prototype, 'noParam')).not.toThrow();
  });

  test('Duplicated param binding', () => {
    const x = Symbol(),
      y = Symbol();
    expect(() => {
      class Foo {
        bar(@MethodInject(x) @MethodInject(y) foo: any) {}
      }
    }).toThrow(MethodParamDecorateError);
  });

  test('Fail for method takes arguments lacks @Inject()', () => {
    @injectable()
    class Foo {
      bar(param: string) {
        return param;
      }
    }

    const container = new Container();
    container.addBinding({
      type: BindingType.CONSTANT,
      id: String,
      value: 'deadbeef',
    });
    container.add(Foo);
    expect(() => invokeMethod(container.createResolveContext(), Foo, 'bar')).toThrow(MethodParamInjectError);
  });

  test('Okay for method takes no argument', () => {
    @injectable()
    class Foo {
      bar() {}
    }

    const spy = jest.spyOn(Foo.prototype, 'bar');

    const container = new Container();
    container.add(Foo);
    invokeMethod(container.createResolveContext(), Foo, 'bar');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('Inconsistent param binding', () => {
    @injectable()
    class Foo {
      bar(undecorated: string, param: string) {
        return param;
      }
    }

    const container = new Container();
    container.add(Foo);

    container.addBinding({
      type: BindingType.CONSTANT,
      id: String,
      value: 'deadbeef',
    });
    expect(() => invokeMethod(container.createResolveContext(), Foo, 'bar')).toThrow();

    MethodInject(String)(Foo.prototype, 'bar', 1);
    expect(() => invokeMethod(container.createResolveContext(), Foo, 'bar')).toThrow();

    MethodInject(String)(Foo.prototype, 'bar', 2);
    expect(() => invokeMethod(container.createResolveContext(), Foo, 'bar')).toThrow();
  });

  test('Performance test', async () => {
    const a = Symbol(),
      b = Symbol();

    @Component()
    class Test {}

    const container = new Container();
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
        @injectable()
        class X {
          constructor(@inject(constructor) private empty: any) {}
        }

        container.add(X);
        constructor = X;
      } else {
        @injectable()
        class X {
          constructor() {}
        }

        container.add(X);
        constructor = X;
      }
    }

    @Component()
    class Foo {
      bar(
        @MethodInject(a, {transform: (x: string) => x.repeat(2)}) param: string,
        @MethodInject(b, {transform: (x: number) => x * x}) number: number,
        @MethodInject(Test) test: Test,
        @MethodInject(constructor) x: any,
      ) {
        return param.repeat(number);
      }
    }

    container.add(Foo);

    let N = 10000;
    // 10000 method invoking should be done within 30s
    const interceptors = Array(100)
      .fill(null)
      .map((value) => {
        return class extends RequestInterceptor {
          async intercept(context: RequestContext, next: () => Promise<void>): Promise<void> {
            context.bindContextValue(Symbol(), value);
            await next();
          }
        };
      });

    class CustomContext extends RequestContext {
      constructor(
        readonly resolveContext: ResolveContext,
        readonly targetConstructor: Constructor,
        readonly targetMethodKey: keyof any,
      ) {
        super();
      }

      bindContextValue<T>(key: ServiceId<T>, value: T): void {
        this.resolveContext.addTemporaryConstantBinding(key, value);
      }
    }

    while (N--) {
      await MethodInvokerBuilder.create(container)
        .addInterceptor(...interceptors)
        .build(Foo, 'bar')
        .invoke({
          contextFactory: (resolveContext, targetConstructor, targetKey) => {
            return new CustomContext(resolveContext, targetConstructor, targetKey);
          },
        });
    }
  }, 10000);
});
