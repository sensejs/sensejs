import {Constructor, RequestContext, RequestInterceptor} from '@sensejs/core';
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

  /**
   * Full url contains query
   */
  readonly url: string;

  readonly search: string;

  /**
   * Path or the url
   */
  readonly path: string;

  /**
   * Requesting Method
   */
  readonly method: string;

  /**
   * Requesting protocol, typically http and https
   */
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

  set(key: string, value: string): void;

  data?: object | Buffer | Readable;
}

export abstract class HttpContext extends RequestContext {
  abstract nativeRequest: unknown;

  abstract nativeResponse: unknown;

  abstract request: HttpRequest;

  abstract response: HttpResponse;
}

export abstract class HttpInterceptor extends RequestInterceptor<HttpContext> {}

export abstract class HttpAdaptor {
  abstract addControllerWithMetadata(controllerMapping: ControllerMetadata): this;

  abstract addGlobalInspector(inspector: Constructor<HttpInterceptor>): this;

  abstract build(appOption: HttpApplicationOption, container: Container): RequestListener;

  abstract getAllInterceptors(): Constructor<HttpInterceptor>[];
}
