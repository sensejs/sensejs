import {Container, decorate, inject, injectable} from 'inversify';
import {RequestListener} from 'http';
import {Constructor, invokeMethod, ServiceIdentifier} from '@sensejs/core';
import Koa from 'koa';
import KoaRouter from 'koa-router';
import koaBodyParser from 'koa-bodyparser';
import {
  BindingSymbolForBody,
  BindingSymbolForHeader,
  BindingSymbolForPath,
  BindingSymbolForQuery,
  ControllerMetadata,
  getHttpControllerMetadata,
  getRequestMappingMetadata,
} from './http-decorators';
import {HttpAdaptor, HttpContext, HttpInterceptor} from './http-abstract';
import {Readable} from 'stream';

export class KoaHttpApplicationBuilder extends HttpAdaptor {
  private globalRouter = new KoaRouter();
  private globalInterceptors: Constructor<HttpInterceptor>[] = [];

  addController(controller: Constructor<unknown>) {
    const controllerMapping = getHttpControllerMetadata(controller);
    if (controllerMapping) {
      this.addControllerMapping(controllerMapping);
    }
  }

  addControllerMapping(controllerMapping: ControllerMetadata): this {
    const localRouter = new KoaRouter();
    for (const propertyDescriptor of Object.values(Object.getOwnPropertyDescriptors(controllerMapping.prototype))) {
      const requestMapping = getRequestMappingMetadata(propertyDescriptor.value);
      if (!requestMapping) {
        continue;
      }
      const interceptors = [
        ...this.globalInterceptors,
        ...controllerMapping.interceptors,
        ...requestMapping.interceptors,
      ];
      const pipelineConstructor = this.createInterceptorPipeline(interceptors);
      this.container.bind(pipelineConstructor).toSelf();

      localRouter[requestMapping.httpMethod](requestMapping.path, async (ctx: any) => {
        const container = ctx.container;
        if (!(container instanceof Container)) {
          throw new Error('ctx.container is not an instance of Container');
        }
        // @ts-ignore
        container.bind(BindingSymbolForBody).toConstantValue(ctx.request.body);
        container.bind(BindingSymbolForPath).toConstantValue(ctx.params);
        const httpContext = container.get<HttpContext>(HttpContext);
        const interceptorPipeline = container.get(pipelineConstructor);
        await interceptorPipeline.beforeRequest(httpContext);
        const target = container.get<object>(controllerMapping.target);
        httpContext.responseValue = await invokeMethod(container, target, propertyDescriptor.value);
        await interceptorPipeline.afterRequest(httpContext);
      });
    }
    this.globalRouter.use(controllerMapping.path!, localRouter.routes(), localRouter.allowedMethods());
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

  private createInterceptorPipeline(interceptorConstructors: Constructor<HttpInterceptor>[]) {
    @injectable()
    class Pipeline {
      private readonly interceptorsForRequest: HttpInterceptor[];
      private readonly interceptorsForResponse: HttpInterceptor[] = [];

      constructor(...interceptors: HttpInterceptor[]) {
        this.interceptorsForRequest = interceptors;
      }

      async beforeRequest(httpContext: HttpContext) {
        for (const interceptor of this.interceptorsForRequest) {
          await interceptor.beforeRequest(httpContext);
          this.interceptorsForResponse.unshift(interceptor);
        }
      }

      async afterRequest(httpContext: HttpContext, e?: Error) {
        for (const interceptor of this.interceptorsForResponse.reverse()) {
          try {
            await interceptor.afterRequest(httpContext, e);
            e = undefined;
          } catch (cascadeError) {
            e = cascadeError;
          }
        }
      }
    }

    interceptorConstructors.forEach((interceptorConstructor, idx) => {
      const paramDecorator = inject(interceptorConstructor) as ParameterDecorator;
      decorate(paramDecorator, Pipeline, idx);
    });

    return Pipeline;
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
