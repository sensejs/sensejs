import {BindingType, Container, Injectable, ResolveSession, ServiceId} from '@sensejs/container';
import {Component, Constructor, Inject, MethodInvokerBuilder, RequestContext, RequestInterceptor} from '../src';

describe('@Inject', () => {
  test('Performance test', async () => {
    const a = Symbol(),
      b = Symbol();

    @Component()
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

    @Component()
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
        readonly resolveContext: ResolveSession,
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
