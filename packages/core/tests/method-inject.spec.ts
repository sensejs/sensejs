import {Container, inject, injectable, interfaces} from 'inversify';
import {
  Component,
  composeRequestInterceptor,
  invokeMethod,
  MethodInject,
  MethodParamDecorateError,
  MethodParamInjectError,
  RequestContext,
  RequestInterceptor,
  validateMethodInjectMetadata,
} from '../src';
import {Constructor} from '@sensejs/utility';
import ServiceIdentifier = interfaces.ServiceIdentifier;

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
    container.bind(x).toConstantValue(constValue);
    container.bind(y).toConstantValue(2);
    container.bind(Foo).toSelf();
    expect(invokeMethod(container, Foo, 'bar')).toBe(constValue.repeat(3));
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
    container.bind(String).toConstantValue('deadbeef');
    container.bind(Foo).toSelf();
    expect(() => invokeMethod(container, Foo, 'bar')).toThrow(MethodParamInjectError);
  });

  test('Okay for method takes no argument', () => {
    @injectable()
    class Foo {
      bar() {}
    }
    const spy = jest.spyOn(Foo.prototype, 'bar');

    const container = new Container();
    container.bind(Foo).toSelf();
    invokeMethod(container, Foo, 'bar');
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
    container.bind(Foo).toSelf();

    container.bind(String).toConstantValue('deadbeef');
    expect(() => invokeMethod(container, Foo, 'bar')).toThrow();

    MethodInject(String)(Foo.prototype, 'bar', 1);
    expect(() => invokeMethod(container, Foo, 'bar')).toThrow();

    MethodInject(String)(Foo.prototype, 'bar', 2);
    expect(() => invokeMethod(container, Foo, 'bar')).toThrow();
  });

  test('Performance test', async () => {
    const a = Symbol(),
      b = Symbol();

    @Component()
    class Test {}

    const container = new Container();
    container.bind(a).toConstantValue('deadbeef');
    container.bind(b).toConstantValue(2);
    let constructor: any;
    for (let i = 0; i < 10000; i++) {
      if (i % 100) {
        container.bind(Symbol()).toConstantValue(i);
        continue;
      }
      if (constructor) {
        @injectable()
        class X {
          constructor(@inject(constructor) private empty: any) {}
        }

        container.bind(X).to(X);
        constructor = X;
      } else {
        @injectable()
        class X {
          constructor() {}
        }

        container.bind(X).to(X);
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

    container.bind(Foo).toSelf();

    let N = 10000;
    // 10000 method invoking should be done within 30s
    const interceptors = Array(10)
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
        readonly container: Container,
        readonly targetConstructor: Constructor,
        readonly targetMethodKey: keyof any,
      ) {
        super();
      }

      bindContextValue<T>(key: ServiceIdentifier<T>, value: T): void {
        this.container.bind(key).toConstantValue(value);
      }
    }

    const t = Date.now();
    while (N--) {
      const childContainer = container.createChild();
      const interceptor = composeRequestInterceptor(childContainer, interceptors);
      childContainer.bind(Test).toConstantValue(new Test());
      await childContainer.get(interceptor).intercept(new CustomContext(childContainer, Foo, 'bar'), async () => {
        invokeMethod(childContainer, Foo, 'bar');
      });
    }
    console.log('duration: ', Date.now() - t);
  }, 10000);
});
