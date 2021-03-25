// import {
//   composeRequestInterceptor,
//   Constructor,
//   Inject,
//   RequestContext,
//   RequestInterceptor,
//   ServiceIdentifier,
// } from '../src';
// import {BindingType, Container, ResolveContext} from '@sensejs/container';
//
// const FOO_SYMBOL = Symbol('FOO_SYMBOL'),
//   BAR_SYMBOL = Symbol('BAR_SYMBOL');
//
// class FooInterceptor extends RequestInterceptor {
//   async intercept(context: RequestContext, next: () => Promise<void>) {
//     context.bindContextValue(FOO_SYMBOL, Math.random());
//     await next();
//   }
// }
//
// class BarInterceptor extends RequestInterceptor {
//   async intercept(context: RequestContext, next: () => Promise<void>) {
//     context.bindContextValue(BAR_SYMBOL, Math.random());
//     await next();
//   }
// }
//
// class MockRequestContext extends RequestContext {
//   get targetConstructor(): Constructor {
//     throw new Error('mock');
//   }
//   get targetMethodKey(): keyof any {
//     throw new Error('mock');
//   }
//   constructor(private resolveContext: ResolveContext) {
//     super();
//   }
//
//   bindContextValue<T>(key: ServiceIdentifier<T>, value: T): void {
//     this.resolveContext.addTemporaryConstantBinding(key, value);
//
//   }
// }
//
// describe('Interceptor', () => {
//   const container = new Container();
//
//   function prepareRequestContext() {
//     const container = new Container();
//     container.addBinding({
//       type: BindingType.CONSTANT,
//       id: Container,
//       value: container
//     });
//     const context = new MockRequestContext(container.createResolveContext());
//     return {container: container, context};
//   }
//
//   beforeEach(() => {
//     jest.restoreAllMocks();
//   });
//
//   test('empty', async () => {
//     const {container, context: ctx} = prepareRequestContext();
//     const emptyInterceptor = composeRequestInterceptor(container, []);
//     await container.get(emptyInterceptor).intercept(ctx, () => Promise.resolve());
//   });
//   test('single', async () => {
//     const {container, context: ctx} = prepareRequestContext();
//     const fooSpy = jest.spyOn(FooInterceptor.prototype, 'intercept');
//     const singleInterceptor = composeRequestInterceptor(container, [FooInterceptor]);
//     await container.get(singleInterceptor).intercept(ctx, async () => {
//       expect(container.isBound(FOO_SYMBOL));
//     });
//     expect(fooSpy).toHaveBeenLastCalledWith(ctx, expect.any(Function));
//   });
//
//   test('multiple', async () => {
//     const {container, context} = prepareRequestContext();
//     const fooSpy = jest.spyOn(FooInterceptor.prototype, 'intercept');
//     const barSpy = jest.spyOn(FooInterceptor.prototype, 'intercept');
//     const result = composeRequestInterceptor(container, [FooInterceptor, BarInterceptor]);
//
//     await container.get(result).intercept(context, async () => {
//       expect(container.isBound(FOO_SYMBOL));
//       expect(container.isBound(BAR_SYMBOL));
//     });
//     expect(fooSpy).toHaveBeenLastCalledWith(context, expect.any(Function));
//     expect(barSpy).toHaveBeenLastCalledWith(context, expect.any(Function));
//   });
//
//   test('error occurred', async () => {
//     const {container, context} = prepareRequestContext();
//
//     class MyError extends Error {}
//
//     class BadInterceptor extends RequestInterceptor {
//       async intercept(context: RequestContext, next: () => Promise<void>) {
//         throw new MyError();
//       }
//     }
//
//     const fooSpy = jest.spyOn(FooInterceptor.prototype, 'intercept');
//     const result = composeRequestInterceptor(container, [BadInterceptor, FooInterceptor]);
//
//     await expect(container.get(result).intercept(context, () => Promise.resolve())).rejects.toEqual(
//       expect.any(MyError),
//     );
//     expect(fooSpy).not.toHaveBeenCalled();
//   });
//
//   test('Interceptor can inject symbol from prior interceptor', async () => {
//     const {container, context} = prepareRequestContext();
//     const spy = jest.fn();
//
//     class InjectArgsInterceptor extends RequestInterceptor {
//       constructor(@Inject(FOO_SYMBOL, {transform: () => 0}) private value: any) {
//         super();
//       }
//
//       async intercept(context: RequestContext, next: () => Promise<void>) {
//         spy(this.value);
//         return next();
//       }
//     }
//
//     const result = composeRequestInterceptor(container, [FooInterceptor, BarInterceptor, InjectArgsInterceptor]);
//     await container.get(result).intercept(context, () => Promise.resolve());
//     expect(spy).toHaveBeenCalledWith(0);
//   });
//
//   test('Interceptor should fail to call to next multiple times', async () => {
//     const {container, context} = prepareRequestContext();
//
//     class BadInterceptor extends RequestInterceptor {
//       async intercept(context: RequestContext, next: () => Promise<void>) {
//         await next();
//         await next();
//       }
//     }
//
//     const barSpy = jest.spyOn(BarInterceptor.prototype, 'intercept');
//     const result = composeRequestInterceptor(container, [FooInterceptor, BadInterceptor, BarInterceptor]);
//
//     await expect(container.get(result).intercept(context, () => Promise.resolve())).rejects.toEqual(
//       expect.any(Error),
//     );
//     expect(barSpy).toHaveBeenCalledTimes(1);
//   });
// });
//
xtest('skipped');
