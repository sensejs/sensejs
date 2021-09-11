import {Constructor} from '@sensejs/core';
import {RequestListener} from 'http';
import {AsyncInterceptProvider, Container} from '@sensejs/container';
import Koa from 'koa';
import koaBodyParser, {Options as KoaBodyParserOption} from 'koa-bodyparser';
import KoaRouter from '@koa/router';
import KoaCors from '@koa/cors';
import koaQs from 'koa-qs';
import {
  ControllerMetadata,
  getRequestMappingMetadata,
  HttpApplicationOption,
  HttpContext,
  HttpMethod,
  HttpRequest,
  HttpResponse,
} from '@sensejs/http-common';

interface MethodRouteSpec<T = any> {
  path: string;
  httpMethod: HttpMethod;
  interceptProviders: Constructor<AsyncInterceptProvider>[];
  targetConstructor: Constructor<T>;
  targetMethod: keyof T;
}

interface ControllerRouteSpec {
  path: string;
  methodRouteSpecs: MethodRouteSpec[];
}

export type QueryStringParsingMode = 'simple' | 'extended' | 'strict' | 'first';

class KoaHttpRequest implements HttpRequest {
  get query() {
    return this.context.nativeContext.query;
  }

  get body() {
    return this.context.nativeContext.request.body;
  }

  get rawBody() {
    return this.context.nativeContext.request.rawBody;
  }
  get protocol() {
    return this.context.nativeContext.protocol;
  }
  get url() {
    return this.context.nativeContext.url;
  }
  get path() {
    return this.context.nativeContext.request.path;
  }
  get search() {
    return this.context.nativeContext.request.search;
  }
  get method() {
    return this.context.nativeContext.request.method;
  }
  get address() {
    return this.context.nativeContext.request.ip;
  }
  get params() {
    return this.context.nativeContext.params;
  }
  get headers() {
    return this.context.nativeContext.headers;
  }
  get hostname() {
    return this.context.nativeContext.hostname;
  }

  constructor(private context: KoaHttpContext) {}
}

class KoaHttpResponse implements HttpResponse {
  statusCode?: number;

  data?: any;

  readonly headerSet: Map<string, string> = new Map();

  constructor(private koaHttpContext: KoaHttpContext) {}

  set(key: string, value: string): void {
    this.headerSet.set(key, value);
  }
}

export class KoaHttpContext extends HttpContext {
  readonly nativeRequest: Koa.Request;

  readonly nativeResponse: Koa.Response;

  readonly request: KoaHttpRequest;

  readonly response: KoaHttpResponse;

  constructor(
    readonly nativeContext: KoaRouter.RouterContext,
    public readonly targetConstructor: Constructor,
    public readonly targetMethodKey: keyof any,
  ) {
    super();
    this.nativeRequest = this.nativeContext.request;
    this.nativeResponse = this.nativeContext.response;
    this.request = new KoaHttpRequest(this);
    this.response = new KoaHttpResponse(this);
  }
}

export class KoaHttpApplicationBuilder {
  // private readonly globalInterceptors: Constructor<HttpInterceptor>[] = [];
  private readonly globalInterceptProviders: Constructor<AsyncInterceptProvider>[] = [];
  private readonly controllerRouteSpecs: ControllerRouteSpec[] = [];
  private errorHandler?: (e: unknown) => any;
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

  addGlobalInterceptProvider(...interceptProvider: Constructor<AsyncInterceptProvider>[]): this {
    this.globalInterceptProviders.push(...interceptProvider);
    return this;
  }

  setErrorHandler(cb: (e: unknown) => any): this {
    this.errorHandler = cb;
    return this;
  }

  build(httpAppOption: HttpApplicationOption, container: Container): RequestListener {
    const koa = this.createKoaInstance();
    const {corsOption, trustProxy = false} = httpAppOption;
    const errorHandler = this.errorHandler;
    koa.proxy = trustProxy;
    if (corsOption) {
      koa.use(KoaCors(corsOption as KoaCors.Options)); // There are typing errors on @types/koa__cors
    }
    koa.use(koaBodyParser(this.bodyParserOption));
    for (const middleware of this.middlewareList) {
      koa.use(middleware);
    }
    const router = this.createGlobalRouter(container);
    koa.use(router.routes());
    koa.use(router.allowedMethods());
    if (errorHandler) {
      koa.on('error', errorHandler);
    }

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

    const {httpMethod, path, interceptProviders = []} = requestMappingMetadata;

    methodRoutSpecs.push({
      path,
      httpMethod,
      // interceptors: [...this.globalInterceptors, ...controllerMetadata.interceptors, ...interceptors],
      interceptProviders: [
        ...this.globalInterceptProviders,
        ...controllerMetadata.interceptProviders,
        ...interceptProviders,
      ],
      targetConstructor: controllerMetadata.target,
      targetMethod: method,
    });
  }

  protected createGlobalRouter(container: Container): KoaRouter {
    const globalRouter = new KoaRouter();
    for (const controllerRouteSpec of this.controllerRouteSpecs) {
      const controllerRouter = new KoaRouter();
      for (const methodRouteSpec of controllerRouteSpec.methodRouteSpecs) {
        this.defineRouter(methodRouteSpec, controllerRouter, container);
      }
      globalRouter.use(controllerRouteSpec.path, controllerRouter.routes(), controllerRouter.allowedMethods());
    }
    return globalRouter;
  }

  protected defineRouter<T>(
    methodRouteSpec: MethodRouteSpec<T>,
    controllerRouter: KoaRouter,
    container: Container,
  ): void {
    const {httpMethod, path, targetConstructor, targetMethod, interceptProviders} = methodRouteSpec;
    const invoker = container.createMethodInvoker(targetConstructor, targetMethod, interceptProviders, HttpContext);

    controllerRouter[httpMethod](path, async (ctx) => {
      const context = new KoaHttpContext(ctx, targetConstructor, targetMethod);
      const result = await invoker.createInvokeSession().invokeTargetMethod(context);

      ctx.response.body = context.response.data ?? result;
      if (typeof context.response.statusCode === 'number') {
        ctx.response.status = context.response.statusCode;
      }
      context.response.headerSet.forEach((value, key) => {
        ctx.response.set(key, value);
      });
    });
  }
}
