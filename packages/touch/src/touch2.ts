import {ensureMetadataOnPrototype, HttpMethod, HttpParamType, ParamMappingMetadata} from '@sensejs/http-common';
import {Constructor} from '@sensejs/utility';
import * as url from 'url';
import * as lodash from 'lodash';

export interface RequestParam {
  method: HttpMethod;
  url: string;
  headers: {
    [key: string]: string;
  };
  params: {
    [key: string]: string;
  };
  body?: any;
}

export interface Response<T = any> {
  status: number;
  statusText: string;
  headers: {
    [key: string]: string;
  };
  data: T;
}

export interface TouchAdaptor {
  readonly name: string;

  request<T = any>(requestParam: RequestParam): Promise<Response<T>>;
}

export interface RequestParamFactory {
  createRequestParam(adaptor: TouchAdaptor, method: HttpMethod): RequestParam;
}

export class DefaultRequestParamFactory implements RequestParamFactory {

  constructor(private baseUrl: string) {}

  createRequestParam(adaptor: TouchAdaptor, method: HttpMethod): RequestParam {
    return {
      method,
      url: this.baseUrl,
      headers: {},
      params: {},
    };
  }
}

function fillParams(obj: {[key: string]: string}, arg: any, name?: string) {
  if (typeof name === 'undefined') {
    Object.assign(obj, arg);
  } else {
    obj[name] = arg;
  }
}

export function extractParams(
  requestParam: RequestParam,
  path: string,
  paramMetadata: Map<number, ParamMappingMetadata>,
  args: unknown[],
) {

  const urlParam: {[key: string]: string;} = {};

  for (const [index, {type, name}] of paramMetadata.entries()) {
    switch (type) {
      case HttpParamType.PATH:
        fillParams(urlParam, args[index], name);
        break;
      case HttpParamType.BODY:
        if (name) {
          requestParam.body = requestParam.body ?? {};
          lodash.set(requestParam.body, name, args[index]);
        } else {
          lodash.merge(requestParam, args[index]);
        }
        break;
      case HttpParamType.QUERY:
        if (name) {
          requestParam.body = requestParam.body ?? {};
          lodash.set(requestParam.body, name, args[index]);
        } else {
          lodash.merge(requestParam, args[index]);
        }
        break;
      case HttpParamType.HEADER:
        fillParams(requestParam.headers, args[index], name);
        break;
    }
  }

  const relativeUrl = Object.entries(urlParam).reduce((url, [key, value]) => {
    return url.split(`${key}`).join(encodeURIComponent(value));
  }, path);
  requestParam.url = url.resolve(requestParam.url, relativeUrl);
}

export class TouchClientFactory {
  private requestParamFactory: RequestParamFactory = new DefaultRequestParamFactory(this.baseUrl);

  constructor(private readonly touchAdaptor: TouchAdaptor, private readonly baseUrl: string) {
  }

  setRequestParamFactory(requestParamFactory: RequestParamFactory) {
    this.requestParamFactory = requestParamFactory;
    return this;
  }

  createTouchClient<T extends {}>(touchConstructor: Constructor<T>): T {
    const TouchClient = class extends (
      touchConstructor as Constructor
    ) {} as Constructor<T>;

    const prototypeMetadata = ensureMetadataOnPrototype(touchConstructor.prototype, {functionParamMetadata: new Map()});
    for (const [name, functionMetadata] of prototypeMetadata.functionParamMetadata.entries()) {
      const stubMethod = touchConstructor.prototype[name];
      if (typeof stubMethod !== 'function') {
        throw new TypeError('stub method is not a function');
      }
      const {method, path, params} = functionMetadata;

      if (typeof method === 'undefined' || typeof path === 'undefined') {
        continue;
      }

      Object.defineProperty(TouchClient.prototype, name, new Proxy(stubMethod, {
        apply: (target: Function, thisArg: T, argArray: unknown[]) => {
          const requestParam = this.requestParamFactory.createRequestParam(this.touchAdaptor, method);
          extractParams(requestParam, path, params, argArray);
          return this.touchAdaptor.request(requestParam);
        },
      }));
    }

    return new TouchClient();
  }
}
