import {Constructor, RequestInterceptor, RequestContext} from '@sensejs/core';
import {RequestListener} from 'http';
import {Container} from 'inversify';
import {Readable} from 'stream';
import {ControllerMetadata} from './http-decorators';

export abstract class HttpContext extends RequestContext {
  abstract responseStatusCode: number;

  abstract responseValue?: object | Buffer | Readable;
}

export abstract class HttpInterceptor extends RequestInterceptor<HttpContext> {
  intercept(context: HttpContext, next: () => Promise<void>): Promise<void> {
    return next();
  }
}

export abstract class HttpAdaptor {
  constructor(protected readonly container: Container) {}

  abstract addControllerMapping(controllerMapping: ControllerMetadata): this;

  abstract addGlobalInspector(inspector: Constructor<HttpInterceptor>): this;

  abstract build(): RequestListener;
}
