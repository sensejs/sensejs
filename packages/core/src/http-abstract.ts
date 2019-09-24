import {Container, injectable} from 'inversify';
import {ControllerMetadata} from './http-decorators';
import {RequestListener} from "http";
import {Constructor} from './interfaces';

export type HttpControllerReturnValueHandler = (value: any) => any;

export abstract class HttpContext {


    abstract responseStatusCode: number;

    abstract setControllerReturnValueHandler(handler: (value: any) => void): void;

    abstract getControllerReturnValueHandler(): HttpControllerReturnValueHandler | undefined

    abstract bindContextValue(key: any, value: any);
}

export abstract class HttpApplicationBuilder {

    constructor(protected readonly container: Container) {
    }

    abstract addControllerMapping(controllerMapping: ControllerMetadata);

    abstract addGlobalInspector(inspector: Constructor<AbstractHttpInterceptor>);

    abstract build(): RequestListener;
}

@injectable()
export abstract class AbstractHttpInterceptor {

    abstract intercept(context: HttpContext, next: () => Promise<void>): Promise<void>;

}
