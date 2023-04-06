import {Constructor, ServiceId} from './types.js';
import {Injectable} from './decorator.js';

export const METADATA_KEY = Symbol();

export interface Middleware<T extends any[] = any[]> {
  handle(next: (...values: T) => Promise<void>): Promise<void>;
}

export function Middleware<T extends ServiceId[]>(option?: MiddlewareOption<T>) {
  return <U extends Constructor<Middleware<ServiceTypeOf<T>>>>(constructor: U): U => {
    Reflect.defineMetadata(METADATA_KEY, option?.provides ?? [], constructor);
    Injectable()(constructor);
    return constructor;
  };
}

/**
 * @private
 */
export type ServiceTypeOf<T extends any[]> = T extends [ServiceId<infer P>, ...infer Q] ? [P, ...ServiceTypeOf<Q>] : [];

export interface MiddlewareOption<T extends ServiceId[]> {
  provides?: T;
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
