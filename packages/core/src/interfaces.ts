import {injectable, Scope, Class, Constructor, ServiceId as ServiceIdentifier} from '@sensejs/container';
export {Class, Constructor, Transformer, ServiceId as ServiceIdentifier} from '@sensejs/container';

@injectable()
export abstract class ComponentFactory<T> {
  abstract build(): T;
}

// export type ServiceIdentifier<T extends {} = {}> = string | symbol | Class<T>;

export interface BindingSpec {
  scope?: Scope;
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
  cache: WeakMap<{}, T>;
}
