import {composeRequestInterceptor, Constructor, invokeMethod, ServiceIdentifier} from '@sensejs/core';
import {RequestListener} from 'http';
import {Container} from 'inversify';
import Koa from 'koa';
import koaBodyParser from 'koa-bodyparser';
import KoaRouter from 'koa-router';
import KoaCors from '@koa/cors';
import {
  HttpAdaptor,
  HttpApplicationOption,
  HttpContext,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
} from './http-abstract';
import uniq from 'lodash.uniq';
import {ControllerMetadata} from './http-decorators';

export class KoaHttpApplicationBuilder extends HttpAdaptor {
  private globalInterceptors: Constructor<HttpInterceptor>[] = [];
  private interceptors: Constructor<HttpInterceptor>[] = [];
  private controllerRouteMetadata: ControllerMetadata[] = [];

  addControllerWithMetadata(controllerMetadata: ControllerMetadata): this {
    this.interceptors = this.interceptors.concat(controllerMetadata.interceptors);
    this.controllerRouteMetadata.push(controllerMetadata);

    // for (const propertyDescriptor of Object.values(Object.getOwnPropertyDescriptors(controllerMetadata.prototype))) {
    //   if (typeof propertyDescriptor.value !== 'function') {
    //     continue;
    //   }
    //   this.addRouterSpec(controllerRouteSpec.methodRouteSpecs, controllerMetadata, propertyDescriptor.value);
    // }
    return this;
  }

  getAllInterceptors(): Constructor<HttpInterceptor>[] {
    const allInterceptors = this.globalInterceptors.concat(this.interceptors);
    return uniq(allInterceptors);
  }

  addGlobalInspector(inspector: Constructor<HttpInterceptor>): this {
    this.globalInterceptors.push(inspector);
    return this;
  }

  build(httpAppOption: HttpApplicationOption, container: Container): RequestListener {
    const koa = new Koa();
    const {corsOption, trustProxy = false} = httpAppOption;
    koa.proxy = trustProxy;
    koa.use(koaBodyParser());
    if (corsOption) {
      koa.use(KoaCors(corsOption as KoaCors.Options)); // There are typing errors on @types/koa__cors
    }
    koa.use(this.createGlobalRouter(container));
    return koa.callback();
  }
  //
  // private addRouterSpec(methodRoutSpecs: MethodRouteOption[], controllerMetadata: ControllerMetadata, method:
  // Function) {
  //   const requestMappingMetadata = getRequestMappingMetadata(method);
  //   if (!requestMappingMetadata) {
  //     return;
  //   }
  //
  //   const {httpMethod, path, interceptors} = requestMappingMetadata;
  //   this.interceptors = this.interceptors.concat(interceptors);
  //
  //   methodRoutSpecs.push({
  //     path,
  //     httpMethod,
  //     interceptors: [...this.globalInterceptors, ...controllerMetadata.interceptors, ...interceptors],
  //     targetConstructor: controllerMetadata.target,
  //     targetMethod: method,
  //   });
  // }

  private createGlobalRouter(container: Container) {
    const globalRouter = new KoaRouter();
    for (const controllerRouteSpec of this.controllerRouteMetadata) {
      const controllerRouter = new KoaRouter();
      const routeOption = controllerRouteSpec.routeOption;
      const controllerInterceptors = controllerRouteSpec.interceptors;
      for (const [methodName, methodRouteSpec] of routeOption.methodRouteOptions.entries()) {
        const {httpMethod, path, targetConstructor} = methodRouteSpec;
        const composedInterceptor = composeRequestInterceptor(container, [
          ...this.globalInterceptors, ...controllerInterceptors, ...methodRouteSpec.interceptors]);

        controllerRouter[httpMethod](path, async (ctx) => {
          const childContainer = container.createChild();
          childContainer.bind(Container).toConstantValue(childContainer);
          const context = new KoaHttpContext(childContainer, ctx);
          childContainer.bind(HttpContext).toConstantValue(context);
          const interceptor = childContainer.get(composedInterceptor);
          await interceptor.intercept(context, async () => {
            const target = childContainer.get<object>(targetConstructor);
            context.response.data = await invokeMethod(childContainer, target, target[methodName]);
          });
        });
      }
      globalRouter.use(routeOption.path, controllerRouter.routes(), controllerRouter.allowedMethods());
    }
    return globalRouter.routes();
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
      hostname: context.request.hostname,
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

  get nativeRequest(): unknown {
    return this.koaContext.request;
  }

  get nativeResponse(): unknown {
    return this.koaContext.response;
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
