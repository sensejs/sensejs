import {composeRequestInterceptor, Constructor, invokeMethod, ServiceIdentifier} from '@sensejs/core';
import {RequestListener} from 'http';
import {Container} from 'inversify';
import Koa from 'koa';
import koaBodyParser from 'koa-bodyparser';
import KoaRouter from 'koa-router';
import {Readable} from 'stream';
import {HttpAdaptor, HttpContext, HttpInterceptor} from './http-abstract';
import {
  BindingSymbolForBody,
  BindingSymbolForHeader,
  BindingSymbolForPath,
  BindingSymbolForQuery,
  ControllerMetadata,
  getHttpControllerMetadata,
  getRequestMappingMetadata,
} from './http-decorators';

export class KoaHttpApplicationBuilder extends HttpAdaptor {
  private globalRouter = new KoaRouter();
  private globalInterceptors: Constructor<HttpInterceptor>[] = [];

  addController(controller: Constructor<unknown>) {
    const controllerMapping = getHttpControllerMetadata(controller);
    if (controllerMapping) {
      this.addControllerMapping(controllerMapping);
    }
  }

  addControllerMapping(controllerMetadata: ControllerMetadata): this {
    const localRouter = new KoaRouter();
    for (const propertyDescriptor of Object.values(Object.getOwnPropertyDescriptors(controllerMetadata.prototype))) {
      const requestMappingMetadata = getRequestMappingMetadata(propertyDescriptor.value);
      if (!requestMappingMetadata) {
        continue;
      }
      const interceptors = [
        ...this.globalInterceptors,
        ...controllerMetadata.interceptors,
        ...requestMappingMetadata.interceptors,
      ];
      const composedInterceptor = this.createComposedInterceptor(interceptors);

      localRouter[requestMappingMetadata.httpMethod](requestMappingMetadata.path, async (ctx: any) => {
        const container = ctx.container;
        if (!(container instanceof Container)) {
          throw new Error('ctx.container is not an instance of Container');
        }
        container.bind(BindingSymbolForBody).toConstantValue(ctx.request.body);
        container.bind(BindingSymbolForPath).toConstantValue(ctx.params);
        const httpContext = container.get<HttpContext>(HttpContext);
        const interceptor = container.get(composedInterceptor);
        await interceptor.intercept(httpContext, async () => {
          const target = container.get<object>(controllerMetadata.target);
          httpContext.responseValue = await invokeMethod(container, target, propertyDescriptor.value);
        });
      });
    }
    this.globalRouter.use(controllerMetadata.path!, localRouter.routes(), localRouter.allowedMethods());
    return this;
  }

  addGlobalInspector(inspector: Constructor<HttpInterceptor>): this {
    this.globalInterceptors.push(inspector);
    return this;
  }

  build(): RequestListener {
    const koa = new Koa();
    koa.use(koaBodyParser());
    koa.use(async (ctx, next) => {
      const childContainer = this.container.createChild();
      ctx.container = childContainer;
      const context = new KoaHttpContext(childContainer);
      childContainer.bind(HttpContext).toConstantValue(context);
      childContainer.bind(BindingSymbolForHeader).toConstantValue(ctx.headers);
      childContainer.bind(BindingSymbolForQuery).toConstantValue(ctx.query);
      await next();
      if (typeof ctx.response.body !== 'undefined') {
        ctx.response.body = context.responseValue;
      }
      if (typeof context.responseStatusCode !== 'undefined') {
        ctx.response.status = context.responseStatusCode;
      }
    });
    koa.use(this.globalRouter.routes());
    return koa.callback();
  }

  private createComposedInterceptor(interceptorConstructors: Constructor<HttpInterceptor>[]) {
    return composeRequestInterceptor(this.container, interceptorConstructors);
  }
}

export class KoaHttpContext extends HttpContext {
  responseValue?: object | Buffer | Readable;
  responseStatusCode: number = 404;

  constructor(private readonly container: Container) {
    super();
  }

  bindContextValue(key: any, value: any) {
    this.container.bind(key).toConstantValue(value);
  }

  get<T>(key: ServiceIdentifier<T>) {
    return this.container.get<T>(key);
  }
}
