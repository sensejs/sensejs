import {Constructor} from '@sensejs/core';
import {RequestListener} from 'http';
import {Container} from '@sensejs/container';
import Koa from 'koa';
import koaBodyParser, {Options as KoaBodyParserOption} from 'koa-bodyparser';
import KoaRouter from '@koa/router';
import KoaCors from '@koa/cors';
import koaQs from 'koa-qs';
import {
  AbstractHttpApplicationBuilder,
  HttpContext,
  HttpRequest,
  HttpResponse,
  MethodRouteSpec,
} from '@sensejs/http-common';

export type QueryStringParsingMode = 'simple' | 'extended' | 'strict' | 'first';
export type CrossOriginResourceShareOption = KoaCors.Options;
export type BodyParserOption = KoaBodyParserOption;

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

export class KoaHttpApplicationBuilder extends AbstractHttpApplicationBuilder {
  private middlewareList: Koa.Middleware[] = [];
  private bodyParserOption?: KoaBodyParserOption;
  private queryStringParsingMode: QueryStringParsingMode = 'simple';
  private trustProxy = false;
  private corsOption?: CrossOriginResourceShareOption;

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

  setCorsOption(corsOption: CrossOriginResourceShareOption): this {
    this.corsOption = corsOption;
    return this;
  }

  setTrustProxy(trustProxy: boolean): this {
    this.trustProxy = trustProxy;
    return this;
  }

  build(container: Container): RequestListener {
    const koa = this.createKoaInstance();
    const errorHandler = this.errorHandler;
    koa.proxy = this.trustProxy;

    if (this.corsOption) {
      koa.use(KoaCors(this.corsOption as KoaCors.Options)); // There are typing errors on @types/koa__cors
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

  protected defineRouter<T extends {}>(
    methodRouteSpec: MethodRouteSpec<T>,
    controllerRouter: KoaRouter,
    container: Container,
  ): void {
    const {httpMethod, path, targetConstructor, targetMethod, middlewares} = methodRouteSpec;
    const invoker = container.createMethodInvoker(targetConstructor, targetMethod, middlewares, HttpContext);

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
