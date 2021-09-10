import {Component, Constructor, MethodInvokerBuilder, RequestContext, RequestInterceptor} from '../src/';
import {Container, ResolveSession} from '@sensejs/container';
import {Subject} from 'rxjs';

describe('MethodInvoker', () => {
  const contextFactory = (
    resolveContext: ResolveSession,
    targetConstructor: Constructor,
    targetMethodKey: keyof any,
  ) => {
    return new (class extends RequestContext {
      readonly targetConstructor: Constructor = targetConstructor;
      readonly targetMethodKey: keyof any = targetMethodKey;
      protected resolveSession: ResolveSession = resolveContext;
    })();
  };
  test('invoke', async () => {
    const container = new Container();

    const targetCalledSubject = new Subject();
    const targetFinishedSubject = new Subject();

    @Component()
    class Target {
      async foo() {
        targetCalledSubject.complete();
        await targetFinishedSubject.toPromise();
      }
    }

    container.add(Target).compile();

    const before = jest.fn();
    const after = jest.fn();

    class TestInterceptor1 extends RequestInterceptor {
      async intercept(context: RequestContext, next: () => Promise<void>): Promise<void> {
        before(1);
        await next();
        after(1);
      }
    }

    class TestInterceptor2 extends RequestInterceptor {
      async intercept(context: RequestContext, next: () => Promise<void>): Promise<void> {
        before(2);
        await next();
        after(2);
      }
    }

    const invokerBuilder = MethodInvokerBuilder.create(container)
      .addInterceptor(TestInterceptor1)
      .addInterceptor(TestInterceptor2);
    const promise = invokerBuilder.build(Target, 'foo').invoke({
      resolveSession: container.createResolveSession(),
      contextFactory,
    });
    await targetCalledSubject.toPromise();

    expect(before).toHaveBeenNthCalledWith(1, 1);
    expect(before).toHaveBeenNthCalledWith(2, 2);
    expect(after).not.toHaveBeenCalled();
    targetFinishedSubject.complete();
    await promise;
    expect(after).toHaveBeenNthCalledWith(1, 2);
    expect(after).toHaveBeenNthCalledWith(2, 1);
  });

  test('exception can be caught by interceptor', async () => {
    const container = new Container();

    const errorCatcher = jest.fn();

    @Component()
    class Target {
      async foo() {
        throw new Error();
      }
    }
    class TestInterceptor1 extends RequestInterceptor {
      async intercept(context: RequestContext, next: () => Promise<void>): Promise<void> {
        try {
          await next();
        } catch (e) {
          errorCatcher(1);
        }
      }
    }
    class TestInterceptor2 extends RequestInterceptor {
      async intercept(context: RequestContext, next: () => Promise<void>): Promise<void> {
        try {
          await next();
        } catch (e) {
          errorCatcher(2);
          throw e;
        }
      }
    }
    const invokerBuilder = MethodInvokerBuilder.create(container)
      .addInterceptor(TestInterceptor1)
      .addInterceptor(TestInterceptor2);
    const promise = invokerBuilder.build(Target, 'foo').invoke({
      resolveSession: container.createResolveSession(),
      contextFactory,
    });

    await promise;

    expect(errorCatcher).toHaveBeenNthCalledWith(1, 2);
    expect(errorCatcher).toHaveBeenNthCalledWith(2, 1);
  });

  test('uncaught exception', async () => {
    const container = new Container();

    @Component()
    class Target {
      async foo() {}
    }
    container.add(Target).compile();
    class MyError extends Error {}
    class TestInterceptor1 extends RequestInterceptor {
      async intercept(context: RequestContext, next: () => Promise<void>): Promise<void> {
        await next();
        throw new MyError();
      }
    }
    const invokerBuilder = MethodInvokerBuilder.create(container).addInterceptor(TestInterceptor1);
    const promise = invokerBuilder.build(Target, 'foo').invoke({
      resolveSession: container.createResolveSession(),
      contextFactory,
    });

    await expect(promise).rejects.toBeInstanceOf(MyError);
  });
});
