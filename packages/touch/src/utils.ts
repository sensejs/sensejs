import url from 'url';
import {Container} from 'inversify';
import {ParamMappingMetadata, HttpParamType} from '@sensejs/http-common';
import {Class, RequestInterceptor} from '@sensejs/core';

export function buildPath(from: string, to: string) {
  return url.resolve(from, to);
}

export interface IParamObject {
  [key: string]: any;
}

export interface IParamsIndexObject {
  param: IParamObject;
  query: IParamObject;
  body: IParamObject;
  headers: IParamObject;
}

function fillParams(obj: IParamObject, arg: any, name?: string) {
  if (typeof name === 'undefined') {
    Object.assign(obj, arg);
  } else {
    obj[name] = arg;
  }
}

export function extractParams(params: Map<number, ParamMappingMetadata>, args: any[]): IParamsIndexObject {
  const paramsObject: IParamsIndexObject = {
    param: {},
    query: {},
    body: {},
    headers: {},
  };

  for (const [index, {type, name}] of params.entries()) {
    switch (type) {
      case HttpParamType.PATH:
        fillParams(paramsObject.param, args[index], name);
        break;
      case HttpParamType.BODY:
        fillParams(paramsObject.body, args[index], name);
        break;
      case HttpParamType.QUERY:
        fillParams(paramsObject.query, args[index], name);
        break;
      case HttpParamType.HEADER:
        fillParams(paramsObject.headers, args[index], name);
        break;
      default:
        break;
    }
  }

  return paramsObject;
}

export function buildInterceptor(container: Container, interceptor: Class<RequestInterceptor>) {
  if (!container.isBound(interceptor)) {
    container.bind(interceptor);
  }
}
