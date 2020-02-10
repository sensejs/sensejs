import {Container} from 'inversify';
import {RequestContext, ServiceIdentifier} from '@sensejs/core';
import {IParamsIndexObject, IParamObject} from '../utils';
import {HttpMethod} from '@sensejs/http-common';

interface ITouchRequestMetadata extends IParamsIndexObject {
  method: HttpMethod;
  className: string;
  methodName: string;
  path: string;
  args: unknown[];
}

// TODO: abstract client and server context
export class TouchRequestContext extends RequestContext {
  body!: IParamObject;
  param!: IParamObject;
  query!: IParamObject;
  headers!: IParamObject;

  readonly method!: HttpMethod;
  readonly className!: string;
  readonly methodName!: string;
  path!: string;

  readonly args!: unknown[];

  response: any;
  retryCount: number = 0;

  constructor(private container: Container, metadata: ITouchRequestMetadata) {
    super();
    // this.body = body;
    // this.param = param;
    // this.query = query;
    // this.headers = headers;
    // this.method = method;
    // this.className = className;
    // this.methodName = methodName;
    // this.path = path;
    Object.assign(this, metadata);
  }

  bindContextValue<T>(id: ServiceIdentifier, value: T) {
    this.container.bind(id).toConstantValue(value);
  }
}
