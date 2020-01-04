import {DecoratorBuilder, Decorator, Class} from '@sensejs/utility';

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
  name?: string;
}

export interface BodyParamMappingMetadata {
  type: HttpParamType.BODY;
  name?: string;
}

export interface PathParamMappingMetadata {
  type: HttpParamType.PATH;
  name?: string;
}

export interface HeaderParamMappingMetadata {
  type: HttpParamType.HEADER;
  name?: string;
}

export type ParamMappingMetadata =
  | QueryParamMappingMetadata
  | BodyParamMappingMetadata
  | PathParamMappingMetadata
  | HeaderParamMappingMetadata;

interface BaseHttpMeta {
  method?: HttpMethod;
  path?: string;
}

export interface FunctionParamMappingMeta extends BaseHttpMeta {
  params: Map<number, ParamMappingMetadata>;
}

export interface PrototypeMappingMeta<T> extends BaseHttpMeta {
  functionParamMetadata: Map<keyof T, FunctionParamMappingMeta>;
}
type HttpMappingMetadata<T> = Map<keyof T, FunctionParamMappingMeta>;

const HTTP_PARAM_MAPPING_KEY = Symbol();

/**
 * Ensure Http mapping metadata on target prototype
 * @param target - on which metadata need to be ensured
 * @param defaultValue - Default value that will set to target, if not provided, this function will throws Error
 * if target has no metadata
 */
export function ensureMetadataOnPrototype<T>(
  target: T,
  defaultValue?: PrototypeMappingMeta<T>,
): PrototypeMappingMeta<T> {
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
  const map = ensureMetadataOnPrototype<T>(prototype, {functionParamMetadata: new Map()});
  let fpm = map.functionParamMetadata.get(name);
  if (!fpm) {
    fpm = defaultValue;
    if (fpm) {
      map.functionParamMetadata.set(name, fpm);
    } else {
      throw new Error('Metadata not found on target method');
    }
  }
  return fpm;
}

function decorateParam(metadata: ParamMappingMetadata) {
  return <T extends {}>(prototype: T, name: string | symbol, index: number) => {
    const fpm = ensureMetadataOnMethod<T>(prototype, name as keyof T, {params: new Map()});
    if (fpm.params.has(index)) {
      throw new Error('Http param annotation cannot be applied multiple times');
    }
    fpm.params.set(index, metadata);
  };
}

function buildParamDecorator(type: HttpParamType) {
  return function ParamDecorator(name?: string) {
    return new DecoratorBuilder(HttpParamType[type])
      .whenApplyToInstanceMethodParam(decorateParam({type, name}))
      .build();
  };
}

export const Path = buildParamDecorator(HttpParamType.PATH);
export const Body = buildParamDecorator(HttpParamType.BODY);
export const Query = buildParamDecorator(HttpParamType.QUERY);
export const Header = buildParamDecorator(HttpParamType.HEADER);

/**
 * RequestMapping decorator, mapping HTTP request into target method
 *
 * @param httpMethod
 * @param path
 * @decorator
 */
export function RequestMapping(path: string, httpMethod?: HttpMethod) {
  function validMetadata(metadata: BaseHttpMeta) {
    if (typeof metadata.method !== 'undefined' || typeof metadata.path !== 'undefined') {
      throw new Error('RequestMapping annotations cannot be applied multiple times');
    }
    metadata.method = httpMethod;
    metadata.path = path;
  }
  return new DecoratorBuilder('RequestMapping')
    .whenApplyToInstanceMethod(<T extends object>(target: T, method: PropertyKey) => {
      const metadata = ensureMetadataOnMethod<T>(target, method as keyof T, {params: new Map()});
      validMetadata(metadata);
    })
    .whenApplyToConstructor(<T extends object>(target: Class<T>) => {
      const metadata = ensureMetadataOnPrototype<T>(target.prototype, {functionParamMetadata: new Map()});
      validMetadata(metadata);
    })
    .build();
}

function buildHttpRequestMappingDecorator(method: HttpMethod) {
  return function httpMethodRequestMappingDecorator(path: string) {
    return RequestMapping(path, method);
  };
}

/**
 * HTTP request mapping shortcut for get method
 * @param path
 * @decorator
 */
export const GET = buildHttpRequestMappingDecorator(HttpMethod.GET);

/**
 * HTTP request mapping shortcut for post method
 * @param path
 * @decorator
 */
export const POST = buildHttpRequestMappingDecorator(HttpMethod.POST);

/**
 * HTTP request mapping shortcut for patch method
 * @param path
 * @decorator
 */
export const PATCH = buildHttpRequestMappingDecorator(HttpMethod.PATCH);

/**
 * HTTP request mapping shortcut for delete method
 * @param path
 * @decorator
 */
export const DELETE = buildHttpRequestMappingDecorator(HttpMethod.DELETE);

/**
 * HTTP request mapping shortcut for put method
 * @param path
 * @decorator
 */
export const PUT = buildHttpRequestMappingDecorator(HttpMethod.PUT);

