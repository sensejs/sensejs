import {Container, injectable} from 'inversify';
import {ControllerMetadata} from './http-decorators';
import {RequestListener} from 'http';
import {Constructor} from '@sensejs/core';
import {Readable} from 'stream';

export abstract class HttpContext {
  abstract responseStatusCode: number;

  abstract responseValue?: object | Buffer | Readable;

  abstract bindContextValue(key: any, value: any): void;
}

export abstract class HttpAdaptor {
  constructor(protected readonly container: Container) {}

  abstract addControllerMapping(controllerMapping: ControllerMetadata): this;

  abstract addGlobalInspector(inspector: Constructor<HttpInterceptor>): this;

  abstract build(): RequestListener;
}

@injectable()
export abstract class HttpInterceptor {
  async beforeRequest(context: HttpContext): Promise<void> {}

  async afterRequest(context: HttpContext, e?: Error): Promise<void> {}
}
