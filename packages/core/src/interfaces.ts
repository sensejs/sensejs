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

export type ServiceIdentifier<T> = interfaces.ServiceIdentifier<T>;

export interface Constructor<T> extends Function {
  new (...args: any[]): T;
}

export interface Abstract<T> extends Function {
  prototype: T;
}

/**
 *
 */
export interface FactoryProvider<T> {
  provide: ServiceIdentifier<T>;
  factory: Constructor<ComponentFactory<T>>;
  scope?: ComponentScope;
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
export interface ComponentMetadata<T> {
  onBind(
    bind: interfaces.Bind,
    unbind: interfaces.Unbind,
    isBound: interfaces.IsBound,
    rebind: interfaces.Rebind,
  ): Promise<void>;
}
