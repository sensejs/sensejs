import {injectable, interfaces} from 'inversify';

export enum ComponentScope {
  SINGLETON,
  REQUEST,
  TRANSIENT,
}

export type ComponentFactoryContext = interfaces.Context;

@injectable()
export abstract class ComponentFactory<T> {
  abstract build(context: ComponentFactoryContext): T;
}

export type ServiceIdentifier<T extends {} = {}> = string | symbol | Class<T>;

export interface Class<T extends {} = {}> extends Function {
  prototype: T;
}

export interface Constructor<T extends {} = {}> extends Class<T> {
  new(...args: any[]): T;
}

export interface BindingSpec {
  scope?: ComponentScope;
  name?: string | symbol;
  tags?: {
    key: symbol | string | number;
    value: unknown;
  }[];
}

/**
 *
 */
export interface FactoryProvider<T> extends BindingSpec {
  provide: ServiceIdentifier<T>;
  factory: Constructor<ComponentFactory<T>>;
}

/**
 * Provide an constant in singleton scope
 */
export interface ConstantProvider<T> {
  provide: ServiceIdentifier<T>;
  value: T;
}

/**
 * Component metadata
 *
 * Specify how to register an component into IoC Container, as well as its scope
 */
export interface ComponentMetadata<T extends {} = {}> extends BindingSpec {
  target: Constructor<T>;
  id?: ServiceIdentifier<T>;
}
