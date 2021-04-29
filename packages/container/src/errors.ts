import {Constructor, ParamInjectionMetadata, ServiceId} from './types';

export class NoEnoughInjectMetadataError<T extends {}> extends Error {
  constructor(private target: Constructor<T>, private methodKey?: keyof T) {
    super();
    Error.captureStackTrace(this, NoEnoughInjectMetadataError);
  }
}

export class InvalidParamBindingError extends Error {
  constructor(readonly received: ParamInjectionMetadata[], readonly invalidIndex: number) {
    super();
    Error.captureStackTrace(this, InvalidParamBindingError);
  }
}
export class DuplicatedBindingError extends Error {
  constructor(readonly serviceId: ServiceId) {
    super();
    Error.captureStackTrace(this, DuplicatedBindingError);
  }
}
export class CircularAliasError extends Error {
  constructor(readonly serviceId: ServiceId) {
    super();
    Error.captureStackTrace(this, CircularAliasError);
  }
}

export class CircularDependencyError extends Error {
  constructor(readonly serviceId: ServiceId) {
    super();
    Error.captureStackTrace(this, CircularDependencyError);
  }
}

export class BindingNotFoundError extends Error {
  constructor(readonly serviceId: ServiceId) {
    super();
    Error.captureStackTrace(this, BindingNotFoundError);
  }
}
