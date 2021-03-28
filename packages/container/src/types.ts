export interface Class<T extends {} = {}> extends Function {
  prototype: T;
}

export interface Constructor<T extends {} = {}> extends Class<T> {
  new (...args: any[]): T;
}

export interface Transformer<Input = any, Output = Input> {
  (input: Input): Output;
}

export enum BindingType {
  CONSTANT = 'CONSTANT',
  INSTANCE = 'INSTANCE',
  FACTORY = 'FACTORY',
  ASYNC_FACTORY = 'ASYNC_FACTORY',
  ASYNC_PROVIDE = 'ASYNC_PROVIDE',
  ALIAS = 'ALIAS',
}

export type ServiceId<T = any> = Class<T> | string | symbol;

export enum Scope {
  SINGLETON = 'SINGLETON',
  REQUEST = 'REQUEST',
  TRANSIENT = 'TRANSIENT',
}

export interface ParamInjectionMetadata<T = any> {
  index: number;
  id: ServiceId<T>;
  optional: boolean;
  transform?: Transformer<T>;
}
export type AsyncResolveInterceptor = (next: () => Promise<void>) => Promise<any>;
