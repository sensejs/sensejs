import {Container} from 'inversify';
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
    getRequestMappingMetadata
} from './http-decorators';
import {HttpAdaptor, HttpContext, HttpInterceptor} from './http-abstract';


export class KoaHttpApplicationBuilder extends HttpAdaptor {

    private globalRouter = new KoaRouter();

    addController(controller: Constructor<unknown>) {
        const controllerMapping = getHttpControllerMetadata(controller);
        if (controllerMapping) {
            this.addControllerMapping(controllerMapping);
        }
    }

    buildMiddleware(middleware: Constructor<HttpInterceptor>) {
        const symbol = Symbol();
        this.container.bind(symbol).to(middleware);
        return async (ctx: any, next: () => Promise<void>) => {
            const container = ctx.container;
            if (!(container instanceof Container)) {
                throw new Error('ctx.container is not an instance of Container');
            }
            const interceptor = container.get<HttpInterceptor>(symbol);
            const httpContext = container.get<HttpContext>(HttpContext);
            await interceptor.beforeRequest(httpContext);
            await next();
            await interceptor.afterRequest(httpContext);
        };

    }

    addControllerMapping(controllerMapping: ControllerMetadata): this {
        const localRouter = new KoaRouter();
        for (const middleware of controllerMapping.interceptors || []) {
            // TODO: FIX Type conversion
            localRouter.use(this.buildMiddleware(middleware as Constructor<HttpInterceptor>));
        }
        for (const propertyDescriptor of Object.values(Object.getOwnPropertyDescriptors(controllerMapping.prototype))) {
            const requestMapping = getRequestMappingMetadata(propertyDescriptor.value);
            if (!requestMapping) {
                continue;
            }
            const middleware = requestMapping.interceptors.map(x => this.buildMiddleware(x as Constructor<HttpInterceptor>));
            localRouter[requestMapping.httpMethod](requestMapping.path, ...middleware, async (ctx: any) => {
                const container = ctx.container;
                if (!(container instanceof Container)) {
                    throw new Error('ctx.container is not an instance of Container');
                }
                // @ts-ignore
                container.bind(BindingSymbolForBody).toConstantValue(ctx.request.body);
                container.bind(BindingSymbolForPath).toConstantValue(ctx.params);
                const target = container.get<Object>(controllerMapping.target!);
                const httpContext = container.get<HttpContext>(HttpContext);
                const returnValueHandler = httpContext.getControllerReturnValueHandler() || ((value) => ctx.response.body = value);
                returnValueHandler(invokeMethod(container, target, propertyDescriptor.value));
            });


        }
        this.globalRouter.use(controllerMapping.path!, localRouter.routes(), localRouter.allowedMethods());
        return this;
    }

    addGlobalInspector(inspector: Constructor<HttpInterceptor>): this {
        this.globalRouter.use(this.buildMiddleware(inspector));
        return this;
    }


    build(): RequestListener {
        const koa = new Koa();
        koa.use(koaBodyParser());
        koa.use(async (ctx, next) => {
            const childContainer = this.container.createChild();
            ctx.container = childContainer;
            const context = new KoaHttpContext(childContainer);
            context.setControllerReturnValueHandler((value) => {
                ctx.response.status = 200;
                ctx.response.body = value;
            });
            childContainer.bind(HttpContext).toConstantValue(context);
            childContainer.bind(BindingSymbolForHeader).toConstantValue(ctx.headers);
            childContainer.bind(BindingSymbolForQuery).toConstantValue(ctx.query);
            next();
        });
        koa.use(this.globalRouter.routes());
        return koa.callback();
    }

}

export class KoaHttpContext extends HttpContext {

    private returnValueHandler?: (value: any) => void;
    responseStatusCode: number = 404;

    constructor(private readonly container: Container) {
        super();
    }

    setControllerReturnValueHandler(handler: (value: any) => void) {
        this.returnValueHandler = handler;
    }

    getControllerReturnValueHandler() {
        return this.returnValueHandler;
    }

    bindContextValue(key: any, value: any) {
        this.container.bind(key).toConstantValue(value);
    }

    get<T>(key: ServiceIdentifier<T>) {
        return this.container.get<T>(key);
    }
}

