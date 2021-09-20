import {InstanceMethodDecorator, InstanceMethodParamDecorator} from '@sensejs/utility';
import {Component, Inject, InjectionDecorator, Transformer} from '@sensejs/core';
import {Constructor} from '@sensejs/core';
import {IncomingHttpHeaders} from 'http';
import {AsyncInterceptProvider, ParamInjectionMetadata} from '@sensejs/container';

export enum HttpMethod {
  GET = 'get',
  POST = 'post',
  PUT = 'put',
  DELETE = 'delete',
  PATCH = 'patch',
  HEAD = 'head',
  OPTIONS = 'options',
}

export enum HttpParamType {
  QUERY,
  BODY,
  PATH,
  HEADER,
}

export interface QueryParamMappingMetadata {
  type: HttpParamType.QUERY;
}

export interface BodyParamMappingMetadata {
  type: HttpParamType.BODY;
}

export interface PathParamMappingMetadata {
  type: HttpParamType.PATH;
  name: string;
}

export interface HeaderParamMappingMetadata {
  type: HttpParamType.HEADER;
  name: string;
}

export type ParamMappingMetadata =
  | QueryParamMappingMetadata
  | BodyParamMappingMetadata
  | PathParamMappingMetadata
  | HeaderParamMappingMetadata;

export interface FunctionParamMappingMeta {
  method?: HttpMethod;
  path?: string;
  params: Map<number, ParamMappingMetadata>;
}

type HttpMappingMetadata<T> = Map<keyof T, FunctionParamMappingMeta>;

export interface ControllerOption {
  interceptProviders?: Constructor<AsyncInterceptProvider>[];

  /**
   * Label of controller
   *
   * @see HttpModuleOption
   */
  labels?: (string | symbol)[] | Set<symbol | string>;
}

export interface ControllerMetadata<T extends {} = {}> {
  /** @deprecated */
  path: string;
  target: Constructor;
  prototype: object;
  // interceptors: Constructor<HttpInterceptor>[];
  interceptProviders: Constructor<AsyncInterceptProvider>[];
  labels: Set<string | symbol>;
}

export interface CrossOriginResourceShareOption {
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

export interface RequestMappingMetadata {
  interceptProviders?: Constructor<AsyncInterceptProvider>[];
  httpMethod: HttpMethod;
  path: string;
}

export interface RequestMappingOption {
  interceptProviders?: Constructor<AsyncInterceptProvider>[];
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

  readonly rawBody: string | Buffer;

  readonly address: string;

  readonly query?: unknown;

  readonly params: {
    [name: string]: string | undefined;
  };
  readonly headers: IncomingHttpHeaders;
}

export interface HttpResponse {
  statusCode?: number;

  set(key: string, value: string): void;

  data?: any;
}

export abstract class HttpContext {
  abstract readonly targetConstructor: Constructor;

  abstract readonly targetMethodKey: keyof any;

  abstract readonly nativeRequest: unknown;

  abstract readonly nativeResponse: unknown;

  abstract readonly nativeContext: unknown;

  abstract readonly request: HttpRequest;

  abstract readonly response: HttpResponse;
}

const ControllerMetadataKey = Symbol('ControllerMetadataKey');

function setHttpControllerMetadata<T>(target: Constructor<T>, controllerMetadata: ControllerMetadata<T>) {
  if (Reflect.getMetadata(ControllerMetadataKey, target)) {
    throw new Error('Target constructor is already has controller metadata');
  }
  Reflect.defineMetadata(ControllerMetadataKey, controllerMetadata, target);
}

export function getHttpControllerMetadata(target: Constructor): ControllerMetadata | undefined {
  return Reflect.getMetadata(ControllerMetadataKey, target);
}
const HTTP_PARAM_MAPPING_KEY = Symbol();

/**
 * Ensure Http mapping metadata on target prototype
 * @param target - on which metadata need to be ensured
 * @param defaultValue - Default value that will set to target, if not provided, this function will throws Error
 * if target has no metadata
 */
export function ensureMetadataOnPrototype<T>(target: T, defaultValue?: HttpMappingMetadata<T>): HttpMappingMetadata<T> {
  let metadata = Reflect.getMetadata(HTTP_PARAM_MAPPING_KEY, target);
  if (typeof metadata === 'undefined') {
    if (defaultValue) {
      metadata = defaultValue;
      Reflect.defineMetadata(HTTP_PARAM_MAPPING_KEY, metadata, target);
    } else {
      throw new Error('Metadata not found on target prototype object');
    }
  }
  return metadata;
}

/**
 * Ensure Http mapping metadata on target prototype method
 * @param prototype - on which the method is attached
 * @param name - name of the function
 * @param defaultValue - Default value that will set to target, if not provided, this function will throws Error
 * if target has no metadata
 */
export function ensureMetadataOnMethod<T extends {}>(
  prototype: T,
  name: keyof T,
  defaultValue?: FunctionParamMappingMeta,
): FunctionParamMappingMeta {
  const map = ensureMetadataOnPrototype<T>(prototype, new Map<keyof T, FunctionParamMappingMeta>());
  let fpm = map.get(name);
  if (!fpm) {
    fpm = {params: new Map()};
    if (defaultValue) {
      map.set(name, fpm);
    } else {
      throw new Error('Metadata not found on target method');
    }
  }
  return fpm;
}

function decorateParam(metadata: ParamMappingMetadata): InstanceMethodParamDecorator {
  return <T extends {}, K extends keyof T>(prototype: T, name: K, index: number) => {
    const fpm = ensureMetadataOnMethod<T>(prototype, name as keyof T, {params: new Map()});
    if (fpm.params.has(index)) {
      throw new Error('Http param annotation cannot be applied multiple times');
    }
    fpm.params.set(index, metadata);
  };
}

const noop: Transformer = (x) => x;

export function Path(name: string, transform: Transformer = noop): InstanceMethodParamDecorator {
  return (prototype, key, pd) => {
    Inject(HttpContext, {
      transform: (ctx: HttpContext) => transform(ctx.request.params[name]),
    })(prototype, key, pd);
    decorateParam({type: HttpParamType.PATH, name})(prototype, key, pd);
  };
}

export function Body(transform: Transformer = noop): InstanceMethodParamDecorator {
  return (prototype, key, pd) => {
    Inject(HttpContext, {
      transform: (ctx: HttpContext) => transform(ctx.request.body),
    })(prototype, key, pd);
    decorateParam({type: HttpParamType.BODY})(prototype, key, pd);
  };
}

export function Query(transform: Transformer = noop): InstanceMethodParamDecorator {
  return (prototype, key, pd) => {
    Inject(HttpContext, {
      transform: (ctx: HttpContext) => transform(ctx.request.query),
    })(prototype, key, pd);
    decorateParam({type: HttpParamType.QUERY})(prototype, key, pd);
  };
}

export function Header(name: string, transform: Transformer = noop): InstanceMethodParamDecorator {
  return (prototype, key, pd) => {
    Inject(HttpContext, {
      transform: (ctx: HttpContext) => transform(ctx.request.headers[name]),
    })(prototype, key, pd);
    decorateParam({type: HttpParamType.HEADER, name})(prototype, key, pd);
  };
}

const RequestMappingMetadataStoreKey = Symbol('RequestMappingMetadataStoreKey');

function ensureRequestMappingStore(prototype: object): Map<keyof any, RequestMappingMetadata> {
  let result = Reflect.getMetadata(RequestMappingMetadataStoreKey, prototype);
  if (result) {
    return result;
  }
  result = new Map<keyof any, RequestMappingMetadata>();
  Reflect.defineMetadata(RequestMappingMetadataStoreKey, result, prototype);
  return result;
}

function setRequestMappingMetadata(prototype: object, key: keyof any, requestMappingMetadata: RequestMappingMetadata) {
  const store = ensureRequestMappingStore(prototype);
  if (store.has(key)) {
    throw new Error('target method is already decorated with RequestMapping');
  }
  store.set(key, requestMappingMetadata);
}

export function getRequestMappingMetadata(targetMethod: object, key: keyof any): RequestMappingMetadata | undefined {
  const store = ensureRequestMappingStore(targetMethod);
  return store.get(key);
}

export type RequestMappingDecorator = InstanceMethodDecorator;

/**
 * RequestMapping decorator, mapping HTTP request into target method
 *
 * @param httpMethod
 * @param path
 * @param option
 * @decorator
 */
export function RequestMapping(
  httpMethod: HttpMethod,
  path: string,
  option: RequestMappingOption = {},
): RequestMappingDecorator {
  return <T extends {}>(prototype: T, method: keyof T, pd: TypedPropertyDescriptor<any>): void => {
    setRequestMappingMetadata(prototype, method, {
      httpMethod,
      path,
      interceptProviders: option.interceptProviders ?? [],
    });
    const metadata = ensureMetadataOnMethod(prototype, method, {params: new Map()});
    metadata.path = path;
    metadata.method = httpMethod;
  };
}

/**
 * HTTP request mapping shortcut for get method
 * @param path
 * @param option
 * @decorator
 */
export function GET(path: string, option?: RequestMappingOption): RequestMappingDecorator {
  return RequestMapping(HttpMethod.GET, path, option);
}

/**
 * HTTP request mapping shortcut for post method
 * @param path
 * @param option
 * @decorator
 */
export function POST(path: string, option?: RequestMappingOption): RequestMappingDecorator {
  return RequestMapping(HttpMethod.POST, path, option);
}

/**
 * HTTP request mapping shortcut for patch method
 * @param path
 * @param option
 * @decorator
 */
export function PATCH(path: string, option?: RequestMappingOption): RequestMappingDecorator {
  return RequestMapping(HttpMethod.PATCH, path, option);
}

/**
 * HTTP request mapping shortcut for delete method
 * @param path
 * @param option
 * @decorator
 */
export function DELETE(path: string, option?: RequestMappingOption): RequestMappingDecorator {
  return RequestMapping(HttpMethod.DELETE, path, option);
}

/**
 * HTTP request mapping shortcut for put method
 * @param path
 * @param option
 * @decorator
 */
export function PUT(path: string, option?: RequestMappingOption): RequestMappingDecorator {
  return RequestMapping(HttpMethod.PUT, path, option);
}

/**
 * Controller decorator, indicates http adaptor to scan its method for routing request
 * @decorator
 */
export function Controller(path: string, controllerOption: ControllerOption = {}) {
  return (target: Constructor): void => {
    // Decorate target as a component
    Component()(target);
    const labels = controllerOption.labels;
    setHttpControllerMetadata(target, {
      target,
      path,
      prototype: target.prototype,
      interceptProviders: controllerOption.interceptProviders ?? [],
      labels: labels instanceof Set ? labels : new Set(labels),
    });
  };
}
