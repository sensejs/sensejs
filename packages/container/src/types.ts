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
  ALIAS = 'ALIAS',
}

export type ServiceId<T = any> = Class<T> | string | symbol;

export enum InjectScope {
  SINGLETON = 'SINGLETON',
  /** @deprecated */
  REQUEST = 'REQUEST',
  SESSION = 'SESSION',
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
  scope: InjectScope;
  aliasedByInjectableParent?: boolean;
}

export interface FactoryBinding<T> {
  type: BindingType.FACTORY;
  id: ServiceId<T>;
  scope: InjectScope;
  factory: (...args: any[]) => T;
  paramInjectionMetadata: ParamInjectionMetadata[];
}

/**
 * @deprecated
 */
export interface AsyncFactoryBinding<T> {
  type: BindingType.ASYNC_FACTORY;
  id: ServiceId<T>;
  scope: InjectScope.REQUEST | InjectScope.TRANSIENT;
  factory: (...args: any[]) => Promise<T>;
  paramInjectionMetadata: ParamInjectionMetadata[];
}

export type AsyncResolveInterceptor = (next: () => Promise<void>) => Promise<any>;

export interface AsyncResolveInterceptorFactory {
  interceptorBuilder: (...args: any[]) => AsyncResolveInterceptor;
  paramInjectionMetadata: ParamInjectionMetadata[];
}
export interface AsyncInterceptProvider<T extends any[] = any[]> {
  intercept(next: (...values: T) => Promise<void>): Promise<void>;
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
  interceptors?: AsyncResolveInterceptorFactory[];
}

export type InvokeResult<T extends {}, K extends keyof T> = T[K] extends (...args: any[]) => Promise<infer R>
  ? R
  : T[K] extends (...args: any[]) => infer R
  ? R
  : never;
