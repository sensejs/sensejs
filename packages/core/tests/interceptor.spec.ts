import {Container} from 'inversify';
import 'reflect-metadata';
import {composeRequestInterceptor, RequestInterceptor} from '../src';

describe('Interceptor', () => {
  class FooInterceptor extends RequestInterceptor<{}> {
    async intercept(context: {}, next: () => Promise<void>) {
      return next();
    }
  }

  class BarInterceptor extends RequestInterceptor<{}> {
    async intercept(context: {}, next: () => Promise<void>) {
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
    await container.get(emptyInterceptor).intercept({}, () => Promise.resolve());
  });
  test('single', async () => {
    const fooSpy = jest.spyOn(FooInterceptor.prototype, 'intercept');
    const singleInterceptor = composeRequestInterceptor(container, [FooInterceptor]);
    const ctx = {};
    await container.get(singleInterceptor).intercept(ctx, () => Promise.resolve());
    expect(fooSpy).toHaveBeenLastCalledWith(ctx, expect.any(Function));
  });

  test('multiple', async () => {
    const fooSpy = jest.spyOn(FooInterceptor.prototype, 'intercept');
    const barSpy = jest.spyOn(FooInterceptor.prototype, 'intercept');
    const result = composeRequestInterceptor(container, [FooInterceptor, BarInterceptor]);
    const ctx = {};
    await container.get(result).intercept(ctx, () => Promise.resolve());
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
    const ctx = {};
    await expect(container.get(result).intercept(ctx, () => Promise.resolve())).rejects.toEqual(expect.any(Error));
    expect(barSpy).not.toHaveBeenCalled();
  });

  test('multiple call to next', async () => {
    const fooSpy = jest.spyOn(FooInterceptor.prototype, 'intercept');
    const barSpy = jest.spyOn(BarInterceptor.prototype, 'intercept');
    const result = composeRequestInterceptor(container, [FooInterceptor, BarInterceptor]);
    fooSpy.mockImplementation(async (ctx: {}, next: () => Promise<void>) => {
      await next();
      await next();
    });
    const ctx = {};
    await expect(container.get(result).intercept(ctx, () => Promise.resolve())).rejects.toEqual(expect.any(Error));
    expect(barSpy).toHaveBeenCalledTimes(1);
  });
});
