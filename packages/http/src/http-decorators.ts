import {
  Component,
  Constructor,
  ensureParamBindingMetadata,
  getFunctionParamBindingMetadata,
  ParamBinding,
  Transformer,
} from '@sensejs/core';
import {HttpInterceptor} from './http-abstract';

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
  target: Constructor<unknown>;
  prototype: object;
  interceptors: Constructor<HttpInterceptor>[];
}

export interface ControllerOption {
  interceptors?: Constructor<HttpInterceptor>[];
}

const noop: Transformer = (x) => x;

export function Path(name: string, transform: Transformer = noop) {
  return ParamBinding(BindingSymbolForPath, {
    transform: (pathParam: {[name: string]: string}) => transform(pathParam[name]),
  });
}

export function Body(transform: Transformer = noop) {
  return ParamBinding(BindingSymbolForBody, {
    transform,
  });
}

export function Query(transform: Transformer = noop) {
  return ParamBinding(BindingSymbolForQuery, {
    transform,
  });
}

export function Header(name: string, transform: Transformer = noop) {
  name = name.toLowerCase();
  return ParamBinding(BindingSymbolForHeader, {
    transform: (headerSet) => headerSet[name],
  });
}

export interface HttpRequestBuiltinParam {
  body: unknown;
  query: unknown;
  path: {
    [key: string]: string;
  };
  header: {
    [key: string]: string;
  };
}

export const BindingSymbolForHeader = Symbol('HttpParamBindingSymbolForHeader');
export const BindingSymbolForQuery = Symbol('HttpParamBindingSymbolForQuery');
export const BindingSymbolForBody = Symbol('HttpParamBindingSymbolForQuery');
export const BindingSymbolForPath = Symbol('HttpParamBindingSymbolForQuery');

const RequestMappingMetadataKey = Symbol('RequestMappingMetadataKey');

function setRequestMappingMetadata(targetMethod: object, requestMappingMetadata: RequestMappingMetadata) {
  if (Reflect.getMetadata(RequestMappingMetadataKey, targetMethod)) {
    throw new Error('target method is already decorated with RequestMapping');
  }
  Reflect.defineMetadata(RequestMappingMetadataKey, requestMappingMetadata, targetMethod);
}

export function getRequestMappingMetadata(targetMethod: object): RequestMappingMetadata | undefined {
  return Reflect.getMetadata(RequestMappingMetadataKey, targetMethod);
}

/**
 * RequestMapping decorator, mapping HTTP request into target method
 *
 * @param httpMethod
 * @param path
 * @param option
 * @decorator
 */
export function RequestMapping(httpMethod: HttpMethod, path: string, option: RequestMappingOption = {}) {
  return <T extends {}>(prototype: T, method: keyof T & string) => {
    const targetMethod = prototype[method];
    if (typeof targetMethod !== 'function') {
      throw new Error('Request mapping decorator must be applied to a function');
    }
    setRequestMappingMetadata(targetMethod, {
      httpMethod,
      path,
      interceptors: option.interceptors || [],
    });
    ensureParamBindingMetadata(targetMethod);
    const paramBindingMapping = getFunctionParamBindingMetadata(targetMethod);
    for (let i = 0; i < targetMethod.length; i++) {
      // TODO: Further check
      if (!paramBindingMapping.paramsMetadata[i]) {
        throw new Error(`Parameter at position ${i} is not decorated`);
      }
    }
  };
}

/**
 * HTTP request mapping shortcut for get method
 * @param path
 * @param option
 * @decorator
 */
export function GET(path: string, option?: RequestMappingOption) {
  return RequestMapping(HttpMethod.GET, path, option);
}

/**
 * HTTP request mapping shortcut for post method
 * @param path
 * @param option
 * @decorator
 */
export function POST(path: string, option?: RequestMappingOption) {
  return RequestMapping(HttpMethod.POST, path, option);
}

/**
 * HTTP request mapping shortcut for patch method
 * @param path
 * @param option
 * @decorator
 */
export function PATCH(path: string, option?: RequestMappingOption) {
  return RequestMapping(HttpMethod.PATCH, path, option);
}

/**
 * HTTP request mapping shortcut for delete method
 * @param path
 * @param option
 * @decorator
 */
export function DELETE(path: string, option?: RequestMappingOption) {
  return RequestMapping(HttpMethod.DELETE, path, option);
}

/**
 * HTTP request mapping shortcut for put method
 * @param path
 * @param option
 * @decorator
 */
export function PUT(path: string, option?: RequestMappingOption) {
  return RequestMapping(HttpMethod.PUT, path, option);
}

const ControllerMetadataKey = Symbol('ControllerMetadataKey');

function setHttpControllerMetadata(target: Constructor<unknown>, controllerMetadata: ControllerMetadata) {
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
  return <T>(target: Constructor<T>) => {
    // Decorate target as a component
    Component()(target);
    setHttpControllerMetadata(target, {
      target,
      path,
      prototype: target.prototype,
      interceptors: controllerOption.interceptors || [],
    });
  };
}
