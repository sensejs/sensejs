import {Container} from 'inversify';
import {RequestListener} from 'http';
import {Constructor, ServiceIdentifier, invokeMethod} from '@sensejs/core';
import Koa from 'koa';
import KoaRouter from 'koa-router';
import koaBodyParser from 'koa-bodyparser';
import {
    ControllerMetadata,
    getHttpControllerMetadata,
    HttpParamBindingSymbolForHeader,
    HttpParamBindingSymbolForQuery,
    HttpParamBindingSymbolForBody,
    HttpParamBindingSymbolForPath, getRequestMappingMetadata
} from './http-decorators';
import {AbstractHttpInterceptor, HttpAdaptor, HttpContext} from './http-abstract';


export class KoaHttpApplicationBuilder extends HttpAdaptor {

    private koa = new Koa();
    private globalRouter = new KoaRouter();

    addController(controller: Constructor<unknown>) {
        const controllerMapping = getHttpControllerMetadata(controller);
        if (controllerMapping) {
            this.addControllerMapping(controllerMapping);
        }
    }

    buildMiddleware(middleware: Constructor<AbstractHttpInterceptor>) {
        const symbol = Symbol();
        this.container.bind(symbol).to(middleware);
        return async (ctx: any, next: ()=> Promise<void>) => {
            const container = ctx.container;
            if (!(container instanceof Container)) {
                throw new Error('ctx.container is not an instance of Container');
            }
            const interceptor = container.get<AbstractHttpInterceptor>(symbol);
            const httpContext = container.get<HttpContext>(HttpContext);
            await interceptor.intercept(httpContext, next);
        };

    }

    addControllerMapping(controllerMapping: ControllerMetadata): this{
        const localRouter = new KoaRouter();
        for (const middleware of controllerMapping.interceptors || []) {
            // TODO: FIX Type conversion
            localRouter.use(this.buildMiddleware(middleware as Constructor<AbstractHttpInterceptor>));
        }
        for (const propertyDescriptor of Object.values(Object.getOwnPropertyDescriptors(controllerMapping.prototype))) {
            const metadata = getRequestMappingMetadata(propertyDescriptor.value);
            if (!metadata) {
                continue;
            }
            const middleware = metadata.interceptors.map(x => this.buildMiddleware(x as Constructor<AbstractHttpInterceptor>));
            localRouter[metadata.httpMethod](metadata.path, ...middleware, async (ctx) => {
                const container = ctx.container;
                if (!(container instanceof Container)) {
                    throw new Error('ctx.container is not an instance of Container');
                }
                // @ts-ignore
                container.bind(HttpParamBindingSymbolForBody).toConstantValue(ctx.request.body);
                container.bind(HttpParamBindingSymbolForPath).toConstantValue(ctx.params);
                const target = container.get<Object>(controllerMapping.target!);
                const httpContext = container.get<HttpContext>(HttpContext);
                const returnValueHandler = httpContext.getControllerReturnValueHandler() || ((value) => ctx.response.body = value);
                returnValueHandler(invokeMethod(container, target, propertyDescriptor.value));
            });


        }
        this.globalRouter.use(controllerMapping.path!, localRouter.routes(), localRouter.allowedMethods());
        return this;
    }

    addGlobalInspector(inspector: Constructor<AbstractHttpInterceptor>): this{
        this.globalRouter.use(this.buildMiddleware(inspector));
        return this;
    }


    build(): RequestListener {
        this.koa.use(koaBodyParser());
        this.koa.use(async (ctx, next) => {
            const childContainer = this.container.createChild();
            ctx.container = childContainer;
            const context = new KoaHttpContext(childContainer);
            context.setControllerReturnValueHandler((value)=> {
                ctx.response.status = 200;
                ctx.response.body = value;
            });
            childContainer.bind(HttpContext).toConstantValue(context);
            childContainer.bind(HttpParamBindingSymbolForHeader).toConstantValue(ctx.headers);
            childContainer.bind(HttpParamBindingSymbolForQuery).toConstantValue(ctx.query);
            next();
        });
        this.koa.use(this.globalRouter.routes());
        return this.koa.callback();
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

