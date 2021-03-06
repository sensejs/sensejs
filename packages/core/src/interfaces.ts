import {InjectScope, Constructor, ServiceId as ServiceIdentifier} from '@sensejs/container';
export {Class, Constructor, Transformer, ServiceId as ServiceIdentifier} from '@sensejs/container';

export abstract class ComponentFactory<T> {
  abstract build(): T;
}

export interface BindingSpec {
  scope?: InjectScope;
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
  /** @deprecated */
  bindParentConstructor: boolean;
  id?: ServiceIdentifier<T>;
}
