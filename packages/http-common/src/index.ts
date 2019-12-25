import {DecoratorBuilder} from '@sensejs/utility';

export enum HttpMethod {
  GET = 'get',
  POST = 'post',
  PUT = 'put',
  DELETE = 'delete',
  PATCH = 'patch',
  HEAD = 'head',
  OPTIONS = 'options'
}

export enum HttpParamType {
  QUERY,
  BODY,
  PATH,
  HEADER
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

export type ParamMappingMetadata = QueryParamMappingMetadata
  | BodyParamMappingMetadata
  | PathParamMappingMetadata
  | HeaderParamMappingMetadata;

export interface FunctionParamMappingMeta {
  method?: HttpMethod;
  path?: string;
  params: Map<number, ParamMappingMetadata>;
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
  defaultValue?: HttpMappingMetadata<T>,
): HttpMappingMetadata<T> {
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

function decorateParam(metadata: ParamMappingMetadata) {
  return <T extends {}>(prototype: T, name: string | symbol, index: number) => {
    const fpm = ensureMetadataOnMethod<T>(prototype, name as keyof T, {params: new Map()});
    if (fpm.params.has(index)) {
      throw new Error('Http param annotation cannot be applied multiple times');
    }
    fpm.params.set(index, metadata);
  };
}

/**
 * Http param mapping decorator
 * @param name
 */
export function Path(name: string) {
  return new DecoratorBuilder('Path')
    .whenApplyToInstanceMethodParam(decorateParam({type: HttpParamType.PATH,  name}))
    .build();
}

export function Body() {
  return new DecoratorBuilder('Body')
    .whenApplyToInstanceMethodParam(decorateParam({type: HttpParamType.BODY }))
    .build();
}

export function Query() {
  return new DecoratorBuilder('Query')
    .whenApplyToInstanceMethodParam(decorateParam({type: HttpParamType.QUERY}))
    .build();
}

export function Header(name: string) {

  return new DecoratorBuilder('Header')
    .whenApplyToInstanceMethodParam(decorateParam({type: HttpParamType.HEADER, name}))
    .build();
}

/**
 * RequestMapping decorator, mapping HTTP request into target method
 *
 * @param httpMethod
 * @param path
 * @decorator
 */
export function RequestMapping(httpMethod: HttpMethod, path: string) {
  return <T extends {}>(prototype: T, method: keyof T & (string | symbol)) => {
    const metadata = ensureMetadataOnMethod(prototype, method, {params: new Map()});
    if (typeof metadata.method !== 'undefined' || typeof metadata.path !== 'undefined') {
      throw new Error('RequestMapping annotations cannot be applied multiple times');
    }
    metadata.method = httpMethod;
    metadata.path = path;
  };
}

/**
 * HTTP request mapping shortcut for get method
 * @param path
 * @decorator
 */
export function GET(path: string) {
  return RequestMapping(HttpMethod.GET, path);
}

/**
 * HTTP request mapping shortcut for post method
 * @param path
 * @decorator
 */
export function POST(path: string) {
  return RequestMapping(HttpMethod.POST, path);
}

/**
 * HTTP request mapping shortcut for patch method
 * @param path
 * @decorator
 */
export function PATCH(path: string) {
  return RequestMapping(HttpMethod.PATCH, path);
}

/**
 * HTTP request mapping shortcut for delete method
 * @param path
 * @decorator
 */
export function DELETE(path: string) {
  return RequestMapping(HttpMethod.DELETE, path);
}

/**
 * HTTP request mapping shortcut for put method
 * @param path
 * @decorator
 */
export function PUT(path: string) {
  return RequestMapping(HttpMethod.PUT, path);
}
