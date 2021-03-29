import {Component, Constructor, Inject, InjectionDecorator, Transformer} from '@sensejs/core';
import {HttpContext, HttpInterceptor} from './http-abstract';

export enum HttpMethod {
  GET = 'get',
  POST = 'post',
  PUT = 'put',
  DELETE = 'delete',
  PATCH = 'patch',
}

export interface RequestMappingMetadata {
  interceptors: Constructor<HttpInterceptor>[];
  httpMethod: HttpMethod;
  path: string;
}

export interface RequestMappingOption {
  interceptors?: Constructor<HttpInterceptor>[];
}

export interface ControllerMetadata {
  path: string;
  target: Constructor;
  prototype: object;
  interceptors: Constructor<HttpInterceptor>[];
  labels: Set<string | symbol>;
}

export interface ControllerOption {
  /**
   *
   */
  interceptors?: Constructor<HttpInterceptor>[];

  /**
   * Label of controller
   *
   * @see HttpModuleOption
   */
  labels?: (string | symbol)[] | Set<symbol | string>;
}

const noop: Transformer = (x) => x;

export function Path(name: string, transform: Transformer = noop): InjectionDecorator {
  return Inject(HttpContext, {
    transform: (ctx: HttpContext) => transform(ctx.request.params[name]),
  });
}

export function Body(transform: Transformer = noop): InjectionDecorator {
  return Inject(HttpContext, {
    transform: (ctx: HttpContext) => transform(ctx.request.body),
  });
}

export function Query(transform: Transformer = noop): InjectionDecorator {
  return Inject(HttpContext, {
    transform: (ctx: HttpContext) => transform(ctx.request.query),
  });
}

export function Header(name: string, transform: Transformer = noop): InjectionDecorator {
  name = name.toLowerCase();
  return Inject(HttpContext, {
    transform: (ctx: HttpContext) => transform(ctx.request.headers[name]),
  });
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

export interface RequestMappingDecorator {
  <T extends {}>(prototype: T, method: keyof T & string): void;
}

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
  return <T extends {}>(prototype: T, method: keyof T & string): void => {
    setRequestMappingMetadata(prototype, method, {
      httpMethod,
      path,
      interceptors: option.interceptors || [],
    });
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

const ControllerMetadataKey = Symbol('ControllerMetadataKey');

function setHttpControllerMetadata(target: Constructor, controllerMetadata: ControllerMetadata) {
  if (Reflect.getMetadata(ControllerMetadataKey, target)) {
    throw new Error('Target constructor is already has controller metadata');
  }
  Reflect.defineMetadata(ControllerMetadataKey, controllerMetadata, target);
}

export function getHttpControllerMetadata(target: object): ControllerMetadata | undefined {
  return Reflect.getMetadata(ControllerMetadataKey, target);
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
      interceptors: controllerOption.interceptors ?? [],
      labels: labels instanceof Set ? labels : new Set(labels),
    });
  };
}
