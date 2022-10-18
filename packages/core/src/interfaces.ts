import {InjectScope, Constructor, ClassServiceId, GeneralServiceId, ServiceId} from '@sensejs/container';
export {Class, Constructor, Transformer, ServiceId as ServiceIdentifier} from '@sensejs/container';

export abstract class ComponentFactory<T> {
  abstract build(): T;
}

export interface BindingSpec {
  scope?: InjectScope;
}

export interface ClassFactoryProvider<T extends {}> extends BindingSpec {
  provide: ClassServiceId<T>;
  factory: Constructor<ComponentFactory<T>>;
}

export interface ConstantFactoryProvider<T extends {}> extends BindingSpec {
  provide: GeneralServiceId<T>;
  factory: Constructor<ComponentFactory<T>>;
}

/**
 *
 */
export type FactoryProvider = ClassFactoryProvider<any> | ConstantFactoryProvider<any>;

/**
 * Provide an constant in singleton scope
 */
export interface ClassConstantProvider<T extends {}> {
  provide: ClassServiceId<T>;
  value: T;
}

/**
 * Provide an constant in singleton scope
 */
export interface GenericConstantProvider<T> {
  provide: GeneralServiceId<T>;
  value: T;
}

/**
 * Provide an constant in singleton scope
 */
export type ConstantProvider = ClassConstantProvider<any> | GenericConstantProvider<any>;

/**
 * Component metadata
 *
 * Specify how to register a component into IoC Container, as well as its scope
 */
export interface ComponentMetadata<T extends {} = {}> extends BindingSpec {
  target: Constructor<T>;
  /** @deprecated */
  bindParentConstructor: boolean;
  id?: ClassServiceId<T>;
}
