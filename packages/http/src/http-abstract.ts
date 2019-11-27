import {Constructor, RequestInterceptor, RequestContext} from '@sensejs/core';
import {RequestListener} from 'http';
import {Container} from 'inversify';
import {Readable} from 'stream';
import {ControllerMetadata} from './http-decorators';

interface CrossOriginResourceShareOption {
  origin?: string | ((origin: string) => boolean);
  allowedMethods?: string | string[];
  exposeHeaders?: string | string[];
  allowedHeaders?: string | string[];
  maxAge?: number;
  credentials?: boolean;
  keepHeadersOnError?: boolean;
}

export interface HttpApplicationOption {
  trustProxy?: boolean;
  corsOption?: CrossOriginResourceShareOption;
}

export interface HttpRequest {
  readonly url: string;

  readonly method: string;

  readonly protocol: string;

  readonly hostname: string;

  readonly body?: unknown;

  readonly query?: unknown;

  readonly params: {
    [name: string]: string | undefined;
  };
  readonly headers: {
    [name: string]: string | undefined;
  };
}

export interface HttpResponse {
  statusCode?: number;

  data?: object | Buffer | Readable;
}

export abstract class HttpContext extends RequestContext {
  abstract nativeRequest: unknown;

  abstract nativeResponse: unknown;

  abstract request: HttpRequest;

  abstract response: HttpResponse;
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

  abstract build(appOption: HttpApplicationOption): RequestListener;
}
