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

export interface ConstantBinding<T> {
  type: BindingType.CONSTANT;
  id: ServiceId<T>;
  value: T;
}

export interface InstanceBinding<T> {
  type: BindingType.INSTANCE;
  id: ServiceId<T>;
  constructor: Constructor<T>;
  paramInjectionMetadata: ParamInjectionMetadata[];
  scope: Scope;
}

export interface FactoryBinding<T> {
  type: BindingType.FACTORY;
  id: ServiceId<T>;
  scope: Scope;
  factory: (...args: any[]) => T;
  paramInjectionMetadata: ParamInjectionMetadata[];
}

export interface AsyncFactoryBinding<T> {
  type: BindingType.ASYNC_FACTORY;
  id: ServiceId<T>;
  scope: Scope.REQUEST | Scope.TRANSIENT;
  factory: (...args: any[]) => Promise<T>;
  paramInjectionMetadata: ParamInjectionMetadata[];
}

export interface AsyncResolveInterceptorFactory<T> {
  interceptorBuilder: (...args: any[]) => AsyncResolveInterceptor;
  paramInjectionMetadata: ParamInjectionMetadata[];
}

export interface AliasBinding<T> {
  type: BindingType.ALIAS;
  id: ServiceId<T>;
  canonicalId: ServiceId;
}

export type Binding<T> =
  | ConstantBinding<T>
  | InstanceBinding<T>
  | FactoryBinding<T>
  | AsyncFactoryBinding<T>
  | AliasBinding<T>;

export interface AsyncResolveOption {
  interceptors?: AsyncResolveInterceptorFactory<any>[];
}

export type AsyncResolveInterceptor = (next: () => Promise<void>) => Promise<any>;
