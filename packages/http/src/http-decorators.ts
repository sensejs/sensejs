import {Component, MethodInject, validateMethodInjectMetadata} from '@sensejs/core';
import * as httpCommon from '@sensejs/http-common';
import {ensureMetadataOnPrototype, HttpMethod, HttpParamType, ParamMappingMetadata} from '@sensejs/http-common';
import {HttpContext, HttpInterceptor} from './http-abstract';
import {Constructor, DecoratorBuilder, InstanceMethodDecorator, InstanceMethodParamDecorator} from '@sensejs/utility';

/**
 * @deprecated Use `Body` from `@sensejs/http-common` instead
 */
export const Body = httpCommon.Body;
/**
 * @deprecated Use `Header` from `@sensejs/http-common` instead
 */
export const Header = httpCommon.Header;
/**
 * @deprecated Use `Query` from `@sensejs/http-common` instead
 */
export const Query = httpCommon.Query;
/**
 * @deprecated Use `Path` from `@sensejs/http-common` instead
 */
export const Path = httpCommon.Path;
/**
 * @deprecated Use `GET` from `@sensejs/http-common` instead
 */
export const GET = httpCommon.GET;
/**
 * @deprecated Use `PUT` from `@sensejs/http-common` instead
 */
export const PUT = httpCommon.PUT;
/**
 * @deprecated Use `POST` from `@sensejs/http-common` instead
 */
export const POST = httpCommon.POST;
/**
 * @deprecated Use `DELETE` from `@sensejs/http-common` instead
 */
export const DELETE = httpCommon.DELETE;
/**
 * @deprecated Use `PATCH` from `@sensejs/http-common` instead
 */
export const PATCH = httpCommon.PATCH;

interface MethodRouteOption {
  path: string;
  httpMethod: HttpMethod;
  interceptors: Constructor<HttpInterceptor>[];
  targetConstructor: Constructor;
  targetMethod: Function;
}

interface ControllerRouteOption<T extends {}> {
  path: string;
  methodRouteSpecs: MethodRouteOption[];
  methodRouteOptions: Map<keyof T, MethodRouteOption>;
}

export interface ControllerMetadata<T extends {} = {}> {
  /** @deprecated */
  path: string;
  routeOption: ControllerRouteOption<T>;
  /** @deprecated */
  target: Constructor<T>;
  prototype: T;
  interceptors: Constructor<HttpInterceptor>[];
  // routeSpec: Map<keyof T, MethodRouteOption>;
}

export interface ControllerOption {
  interceptors?: Constructor<HttpInterceptor>[];
  tags?: {
    [tag: string]: unknown;
    [tag: number]: unknown;
  };
}

export interface InterceptHttpRequestDecorator extends InstanceMethodDecorator, ClassDecorator {}

export function InterceptHttpRequest(interceptors: Constructor<HttpInterceptor>[]) {
  return new DecoratorBuilder('InterceptHttpRequest')
    .whenApplyToInstanceMethod(() => void 0)
    .whenApplyToConstructor(() => void 0)
    .build();
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

function getDecorator(paramMetadata: ParamMappingMetadata): InstanceMethodParamDecorator {
  const {type, name} = paramMetadata;
  switch (type) {
    case HttpParamType.BODY:
      return MethodInject(HttpContext, {
        transform: (ctx) => (name ? (ctx.request.body as any)[name] : ctx.request.body),
      });
    case HttpParamType.HEADER:
      return MethodInject(HttpContext, {
        transform: (ctx) => (name ? (ctx.request.headers as any)[name] : ctx.request.headers),
      });
    case HttpParamType.PATH:
      return MethodInject(HttpContext, {
        transform: (ctx) => (name ? (ctx.request.params as any)[name] : ctx.request.params),
      });
    case HttpParamType.QUERY:
      return MethodInject(HttpContext, {
        transform: (ctx) => (name ? (ctx.request.query as any)[name] : ctx.request.query),
      });
  }
}

/**
 * Controller decorator, indicates http adaptor to scan its method for routing request
 * @decorator
 */
export function Controller(path: string, controllerOption: ControllerOption = {}) {
  return <T extends {}>(target: Constructor<T>) => {
    const prototype = target.prototype;
    const methodRouteOptions = new Map<keyof T, MethodRouteOption>();
    const metadata = ensureMetadataOnPrototype<T>(prototype, {functionParamMetadata: new Map()});
    for (const [methodName, fnMetadata] of metadata.functionParamMetadata.entries()) {
      for (const [index, paramMetadata] of fnMetadata.params.entries()) {
        const decorator = getDecorator(paramMetadata);
        decorator(prototype, methodName as string | symbol, index);
      }
      const {method, path} = fnMetadata;
      if (typeof method === 'undefined' || typeof path === 'undefined') {
        continue;
      }
      const fn = prototype[methodName];
      if (typeof fn !== 'function') {
        throw new Error();
      }

      validateMethodInjectMetadata(fn);
      methodRouteOptions.set(methodName, {
        httpMethod: method,
        path,
        interceptors: [],
        targetConstructor: target,
        targetMethod: fn,
      });
    }
    // Decorate target as a component
    Component()(target);
    setHttpControllerMetadata(target, {
      routeOption: {
        path,
        methodRouteSpecs: [],
        methodRouteOptions,
      },
      target,
      path,
      prototype: target.prototype,
      interceptors: controllerOption.interceptors || [],
    });
  };
}
