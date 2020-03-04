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
import {ControllerMetadata, getRequestMappingMetadata, HttpMethod} from './http-decorators';

interface MethodRouteSpec {
  path: string;
  httpMethod: HttpMethod;
  interceptors: Constructor<HttpInterceptor>[];
  targetConstructor: Constructor;
  targetMethod: Function;
}

interface ControllerRouteSpec {
  path: string;
  methodRouteSpecs: MethodRouteSpec[];
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

export class KoaHttpApplicationBuilder extends HttpAdaptor {
  private globalInterceptors: Constructor<HttpInterceptor>[] = [];
  private interceptors: Constructor<HttpInterceptor>[] = [];
  private controllerRouteSpecs: ControllerRouteSpec[] = [];

  addControllerWithMetadata(controllerMetadata: ControllerMetadata): this {
    this.interceptors = this.interceptors.concat(controllerMetadata.interceptors);
    const controllerRouteSpec: ControllerRouteSpec = {
      path: controllerMetadata.path,
      methodRouteSpecs: [],
    };
    this.controllerRouteSpecs.push(controllerRouteSpec);

    for (const propertyDescriptor of Object.values(Object.getOwnPropertyDescriptors(controllerMetadata.prototype))) {
      if (typeof propertyDescriptor.value !== 'function') {
        continue;
      }
      this.addRouterSpec(controllerRouteSpec.methodRouteSpecs, controllerMetadata, propertyDescriptor.value);
    }
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

  private addRouterSpec(methodRoutSpecs: MethodRouteSpec[], controllerMetadata: ControllerMetadata, method: Function) {
    const requestMappingMetadata = getRequestMappingMetadata(method);
    if (!requestMappingMetadata) {
      return;
    }

    const {httpMethod, path, interceptors} = requestMappingMetadata;
    this.interceptors = this.interceptors.concat(interceptors);

    methodRoutSpecs.push({
      path,
      httpMethod,
      interceptors: [...this.globalInterceptors, ...controllerMetadata.interceptors, ...interceptors],
      targetConstructor: controllerMetadata.target,
      targetMethod: method,
    });
  }

  private createGlobalRouter(container: Container) {
    const globalRouter = new KoaRouter();
    for (const controllerRouteSpec of this.controllerRouteSpecs) {
      const controllerRouter = new KoaRouter();
      for (const methodRouteSpec of controllerRouteSpec.methodRouteSpecs) {
        const {httpMethod, path, targetConstructor, targetMethod, interceptors} = methodRouteSpec;
        const composedInterceptor = composeRequestInterceptor(container, interceptors);

        controllerRouter[httpMethod](path, async (ctx) => {
          const childContainer = container.createChild();
          childContainer.bind(Container).toConstantValue(childContainer);
          const context = new KoaHttpContext(childContainer, ctx);
          childContainer.bind(HttpContext).toConstantValue(context);
          const interceptor = childContainer.get(composedInterceptor);
          await interceptor.intercept(context, async () => {
            const target = childContainer.get<object>(targetConstructor);
            context.response.data = await invokeMethod(childContainer, target, targetMethod);
          });
        });
      }
      globalRouter.use(controllerRouteSpec.path, controllerRouter.routes(), controllerRouter.allowedMethods());
    }
    return globalRouter.routes();
  }
}
