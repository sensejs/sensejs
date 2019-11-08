import {Container, injectable} from 'inversify';
import {ControllerMetadata} from './http-decorators';
import {RequestListener} from 'http';
import {Constructor, RequestInterceptor} from '@sensejs/core';
import {Readable} from 'stream';

export abstract class HttpContext {
  abstract responseStatusCode: number;

  abstract responseValue?: object | Buffer | Readable;

  abstract bindContextValue(key: any, value: any): void;
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
