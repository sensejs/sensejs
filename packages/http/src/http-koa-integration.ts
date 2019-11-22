import {composeRequestInterceptor, Constructor, invokeMethod, ServiceIdentifier} from '@sensejs/core';
import {RequestListener} from 'http';
import {Container} from 'inversify';
import Koa from 'koa';
import koaBodyParser from 'koa-bodyparser';
import KoaRouter from 'koa-router';
import {Readable} from 'stream';
import {HttpAdaptor, HttpContext, HttpInterceptor, HttpRequest, HttpResponse} from './http-abstract';
import {ControllerMetadata, getHttpControllerMetadata, getRequestMappingMetadata} from './http-decorators';

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
      const {httpMethod, path, interceptors} = requestMappingMetadata;
      const composedInterceptor = this.createComposedInterceptor([
        ...this.globalInterceptors,
        ...controllerMetadata.interceptors,
        ...interceptors,
      ]);

      localRouter[httpMethod](path, async (ctx: KoaRouter.RouterContext) => {
        const childContainer = this.container.createChild();
        childContainer.bind(Container).toConstantValue(childContainer);
        const context = new KoaHttpContext(childContainer, ctx);
        childContainer.bind(HttpContext).toConstantValue(context);
        const interceptor = childContainer.get(composedInterceptor);
        await interceptor.intercept(context, async () => {
          const target = childContainer.get<object>(controllerMetadata.target);
          context.response.data = await invokeMethod(childContainer, target, propertyDescriptor.value);
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
    koa.use(this.globalRouter.routes());
    return koa.callback();
  }

  private createComposedInterceptor(interceptorConstructors: Constructor<HttpInterceptor>[]) {
    return composeRequestInterceptor(this.container, interceptorConstructors);
  }
}

export class KoaHttpContext extends HttpContext {
  get request(): HttpRequest {
    const context = this.koaContext;
    const request = context.request as any;
    return {
      query: context.request.query,
      body: request.body,
      protocol: context.protocol,
      url: context.originalUrl,
      method: context.method,
      params: context.params,
      headers: context.headers,
    };
  }

  get response(): HttpResponse {
    const context = this.koaContext;
    return {
      set statusCode(statusCode) {
        context.response.status = statusCode;
      },

      get statusCode() {
        return context.response.status;
      },

      set data(data) {
        context.body = data;
      },

      get data() {
        return context.body;
      },
    };
  }

  constructor(private readonly container: Container, private readonly koaContext: KoaRouter.RouterContext) {
    super();
  }

  bindContextValue(key: any, value: any) {
    this.container.bind(key).toConstantValue(value);
  }

  get<T>(key: ServiceIdentifier<T>) {
    return this.container.get<T>(key);
  }
}
