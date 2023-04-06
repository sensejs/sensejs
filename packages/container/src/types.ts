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

export type ClassServiceId<T extends {}> = string | symbol | Class<T>;

export type GeneralServiceId<T> = string | symbol;

export type ServiceId<T = any> = T extends {} ? ClassServiceId<T> : GeneralServiceId<T>;

export enum InjectScope {
  SINGLETON = 'SINGLETON',
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

export interface InstanceBinding<T extends {}> {
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

export interface AliasBinding<T> {
  type: BindingType.ALIAS;
  id: ServiceId<T>;
  canonicalId: ServiceId<T>;
}

export type Binding<T> = T extends {}
  ? ConstantBinding<T> | InstanceBinding<T> | FactoryBinding<T> | AliasBinding<T>
  : ConstantBinding<T> | FactoryBinding<T> | AliasBinding<T>;

export type InvokeResult<T extends {}, K extends keyof T> = T[K] extends (...args: any[]) => infer R ? R : never;
