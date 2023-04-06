import {Class, ClassServiceId, Constructor, GeneralServiceId, ServiceId} from './types.js';
import {Injectable} from './decorator.js';

export const METADATA_KEY = Symbol();

/**
 * @private
 */
export type ServiceTypeOf<T extends any[]> = T extends [Class<infer P>, ...infer Q]
  ? [P, ...ServiceTypeOf<Q>]
  : T extends [GeneralServiceId<any>, ...infer Q]
  ? [unknown, ...ServiceTypeOf<Q>]
  : [];

export type Next<T extends any[] = []> = (...args: T) => Promise<void>;

export type Middleware<T extends any[] = any[]> = {
  handle(next: Next<ServiceTypeOf<T>>): Promise<void>;
};

export interface MiddlewareOption<T extends ServiceId[]> {
  provides: [...T];
}

export function Middleware<T extends ServiceId[]>(option?: MiddlewareOption<T>) {
  return <U extends Constructor<Middleware<T>>>(constructor: U): U => {
    Reflect.defineMetadata(METADATA_KEY, option?.provides ?? [], constructor);
    Injectable()(constructor);
    return constructor;
  };
}

/**
 * @deprecated
 * @param serviceIds
 * @constructor
 */
export function MiddlewareClass<T extends ServiceId[]>(...serviceIds: T) {
  return <U extends Constructor<Middleware<ServiceTypeOf<T>>>>(constructor: U): U => {
    Reflect.defineMetadata(METADATA_KEY, serviceIds, constructor);
    Injectable()(constructor);
    return constructor;
  };
}

export function getMiddlewareMetadata(constructor: Constructor): ServiceId<Middleware>[] {
  const metadata = Reflect.getOwnMetadata(METADATA_KEY, constructor);
  if (!Array.isArray(metadata)) {
    throw new Error('missing metadata');
  }
  return metadata;
}
