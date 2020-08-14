import {
  composeRequestInterceptor,
  Constructor,
  invokeMethod,
  RequestInterceptor,
  ServiceIdentifier,
} from '@sensejs/core';
import {RequestListener} from 'http';
import {Container} from 'inversify';
import Koa from 'koa';
import koaBodyParser, {Options as KoaBodyParserOption} from 'koa-bodyparser';
import KoaRouter from '@koa/router';
import KoaCors from '@koa/cors';
import {
  HttpAdaptor,
  HttpApplicationOption,
  HttpContext,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
} from './http-abstract';
import koaQs from 'koa-qs';
import {ControllerMetadata, getRequestMappingMetadata, HttpMethod} from './http-decorators';
import Router from '@koa/router';

interface MethodRouteSpec<T = any> {
  path: string;
  httpMethod: HttpMethod;
  interceptors: Constructor<HttpInterceptor>[];
  targetConstructor: Constructor<T>;
  targetMethod: keyof T;
}

interface ControllerRouteSpec {
  path: string;
  methodRouteSpecs: MethodRouteSpec[];
}

export type QueryStringParsingMode = 'simple' | 'extended' | 'strict' | 'first';

class KoaHttpResponse implements HttpResponse {
  statusCode?: number;

  data?: any;

  headerSet: Map<string, string> = new Map();

  constructor(private koaHttpContext: KoaHttpContext) {}

  set(key: string, value: string): void {
    this.headerSet.set(key, value);
  }
}

export class KoaHttpContext extends HttpContext {
  get request(): HttpRequest {
    const context = this.koaContext;
    const request = context.request as any;
    return {
      query: context.request.query,
      body: request.body,
      rawBody: request.rawBody,
      protocol: context.protocol,
      url: context.originalUrl,
      path: context.path,
      search: context.search,
      method: context.method,
      address: context.request.ip,
      params: context.params,
      headers: context.headers,
      hostname: context.request.hostname,
    };
  }

  readonly response = new KoaHttpResponse(this);

  get nativeRequest(): unknown {
    return this.koaContext.request;
  }

  get nativeResponse(): unknown {
    return this.koaContext.response;
  }

  constructor(private readonly container: Container, private readonly koaContext: KoaRouter.RouterContext) {
    super();
  }

  bindContextValue<T>(key: ServiceIdentifier<T>, value: T): void {
    this.container.bind(key).toConstantValue(value);
  }
}

export class KoaHttpApplicationBuilder extends HttpAdaptor {
  private readonly globalInterceptors: Constructor<HttpInterceptor>[] = [];
  private readonly controllerRouteSpecs: ControllerRouteSpec[] = [];
  private middlewareList: Koa.Middleware[] = [];
  private bodyParserOption?: KoaBodyParserOption;
  private queryStringParsingMode: QueryStringParsingMode = 'simple';

  addControllerWithMetadata(controllerMetadata: ControllerMetadata): this {
    const controllerRouteSpec: ControllerRouteSpec = {
      path: controllerMetadata.path,
      methodRouteSpecs: [],
    };
    this.controllerRouteSpecs.push(controllerRouteSpec);

    for (const [key, propertyDescriptor] of Object.entries(
      Object.getOwnPropertyDescriptors(controllerMetadata.prototype),
    )) {
      if (typeof propertyDescriptor.value === 'function') {
        this.addRouterSpec(controllerRouteSpec.methodRouteSpecs, controllerMetadata, controllerMetadata.prototype, key);
      }
    }
    return this;
  }

  clearMiddleware(): this {
    this.middlewareList = [];
    return this;
  }

  addMiddleware(middleware: Koa.Middleware): this {
    this.middlewareList.push(middleware);
    return this;
  }

  setQueryStringParsingMode(mode: QueryStringParsingMode): this {
    this.queryStringParsingMode = mode;
    return this;
  }

  setKoaBodyParserOption(option: KoaBodyParserOption): this {
    this.bodyParserOption = option;
    return this;
  }

  addGlobalInspector(inspector: Constructor<HttpInterceptor>): this {
    this.globalInterceptors.push(inspector);
    return this;
  }

  build(httpAppOption: HttpApplicationOption, container: Container): RequestListener {
    const koa = this.createKoaInstance();
    const {corsOption, trustProxy = false} = httpAppOption;
    koa.proxy = trustProxy;
    if (corsOption) {
      koa.use(KoaCors(corsOption as KoaCors.Options)); // There are typing errors on @types/koa__cors
    }
    koa.use(koaBodyParser(this.bodyParserOption));
    for (const middleware of this.middlewareList) {
      koa.use(middleware);
    }
    koa.use(this.createGlobalRouter(container));
    return koa.callback();
  }

  private createKoaInstance() {
    const koa = new Koa();
    if (this.queryStringParsingMode === 'simple') {
      return koa;
    }

    return koaQs(koa, this.queryStringParsingMode);
  }

  private addRouterSpec(
    methodRoutSpecs: MethodRouteSpec[],
    controllerMetadata: ControllerMetadata,
    prototype: object,
    method: keyof any,
  ) {
    const requestMappingMetadata = getRequestMappingMetadata(prototype, method);
    if (!requestMappingMetadata) {
      return;
    }

    const {httpMethod, path, interceptors} = requestMappingMetadata;

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
        this.defineRouter(methodRouteSpec, controllerRouter, container);
      }
      globalRouter.use(controllerRouteSpec.path, controllerRouter.routes(), controllerRouter.allowedMethods());
    }
    return globalRouter.routes();
  }

  private defineRouter<T>(
    methodRouteSpec: MethodRouteSpec<T>,
    controllerRouter: Router<any, {}>,
    container: Container,
  ) {
    const {httpMethod, path, targetConstructor, targetMethod, interceptors} = methodRouteSpec;

    controllerRouter[httpMethod](path, async (ctx) => {
      const childContainer = container.createChild();
      const composedInterceptor = composeRequestInterceptor(childContainer, interceptors);
      childContainer.bind(Container).toConstantValue(childContainer);
      const context = new KoaHttpContext(childContainer, ctx);
      childContainer.bind(HttpContext).toConstantValue(context);
      const interceptor: RequestInterceptor = childContainer.get(composedInterceptor);
      await interceptor.intercept(context, async () => {
        const result = await invokeMethod(childContainer, targetConstructor, targetMethod);
        if (typeof context.response.data === 'undefined') {
          context.response.data = result;
        }
      });

      ctx.response.body = context.response.data;
      if (typeof context.response.statusCode === 'number') {
        ctx.response.status = context.response.statusCode;
      }
      context.response.headerSet.forEach((value, key) => {
        ctx.response.set(key, value);
      });
    });
  }
}
