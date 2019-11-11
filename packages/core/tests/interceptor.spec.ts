import {Container, inject, injectable} from 'inversify';
import {composeRequestInterceptor, RequestContext, RequestInterceptor, ServiceIdentifier} from '../src';

class MockRequestContext extends RequestContext {
  constructor(private container: Container) {
    super();
  }

  bindContextValue<T>(key: ServiceIdentifier<T>, value: T): void {
    this.container.bind(key).toConstantValue(value);
  }
}

describe('Interceptor', () => {
  const FOO_SYMBOL = Symbol(),
    BAR_SYMBOL = Symbol();

  class FooInterceptor extends RequestInterceptor {
    async intercept(context: RequestContext, next: () => Promise<void>) {
      context.bindContextValue(FOO_SYMBOL, Math.random());
      return next();
    }
  }

  class BarInterceptor extends RequestInterceptor {
    async intercept(context: RequestContext, next: () => Promise<void>) {
      context.bindContextValue(FOO_SYMBOL, Math.random());
      return next();
    }
  }

  const container = new Container();
  container.bind(FooInterceptor).toSelf();
  container.bind(BarInterceptor).toSelf();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('empty', async () => {
    const container = new Container();

    container.bind(FooInterceptor).toSelf();

    const emptyInterceptor = composeRequestInterceptor(container, []);
    await container.get(emptyInterceptor).intercept(new MockRequestContext(container), () => Promise.resolve());
  });
  test('single', async () => {
    const fooSpy = jest.spyOn(FooInterceptor.prototype, 'intercept');
    const singleInterceptor = composeRequestInterceptor(container, [FooInterceptor]);
    const ctx = new MockRequestContext(container);
    await container.get(singleInterceptor).intercept(ctx, async () => {
      expect(container.isBound(FOO_SYMBOL));
    });
    expect(fooSpy).toHaveBeenLastCalledWith(ctx, expect.any(Function));
  });

  test('multiple', async () => {
    const fooSpy = jest.spyOn(FooInterceptor.prototype, 'intercept');
    const barSpy = jest.spyOn(FooInterceptor.prototype, 'intercept');
    const result = composeRequestInterceptor(container, [FooInterceptor, BarInterceptor]);
    const ctx = new MockRequestContext(container);
    await container.get(result).intercept(ctx, async () => {
      expect(container.isBound(FOO_SYMBOL));
      expect(container.isBound(BAR_SYMBOL));
    });
    expect(fooSpy).toHaveBeenLastCalledWith(ctx, expect.any(Function));
    expect(barSpy).toHaveBeenLastCalledWith(ctx, expect.any(Function));
  });

  test('error occurred', async () => {
    const fooSpy = jest.spyOn(FooInterceptor.prototype, 'intercept');
    const barSpy = jest.spyOn(BarInterceptor.prototype, 'intercept');
    const result = composeRequestInterceptor(container, [FooInterceptor, BarInterceptor]);
    fooSpy.mockImplementation(async (ctx: {}, next: () => Promise<void>) => {
      throw new Error();
    });
    const ctx = new MockRequestContext(container);
    await expect(container.get(result).intercept(ctx, () => Promise.resolve())).rejects.toEqual(expect.any(Error));
    expect(barSpy).not.toHaveBeenCalled();
  });

  test('Interceptor cannot inject symbol from prior interceptor', async () => {
    @injectable()
    class BuggyInterceptor extends RequestInterceptor {
      constructor(@inject(FOO_SYMBOL) value: any) {
        super();
      }

      async intercept(context: RequestContext, next: () => Promise<void>) {
        return next();
      }
    }

    const childContainer = container.createChild();
    const ctx = new MockRequestContext(container);
    const result = composeRequestInterceptor(container, [FooInterceptor, BarInterceptor, BuggyInterceptor]);

    expect(() => childContainer.get(result).intercept(ctx, () => Promise.resolve())).toThrow();
  });

  test('multiple call to next', async () => {
    const fooSpy = jest.spyOn(FooInterceptor.prototype, 'intercept');
    const barSpy = jest.spyOn(BarInterceptor.prototype, 'intercept');
    const result = composeRequestInterceptor(container, [FooInterceptor, BarInterceptor]);
    fooSpy.mockImplementation(async (ctx: {}, next: () => Promise<void>) => {
      await next();
      await next();
    });
    const ctx = new MockRequestContext(container);
    await expect(container.get(result).intercept(ctx, () => Promise.resolve())).rejects.toEqual(expect.any(Error));
    expect(barSpy).toHaveBeenCalledTimes(1);
  });
});
