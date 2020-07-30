import {ConstantProvider, Constructor, FactoryProvider} from './interfaces';
import {decorate, injectable} from 'inversify';
import {ensureMethodInjectMetadata} from './method-inject';

/**
 * Options to define a module
 */
export interface ModuleOption {
  /**
   * Dependencies of this module, must be decorated
   */
  requires?: Constructor[];

  /**
   * Components provided by this module
   */
  components?: Constructor[];

  /**
   * Factories provided by this module
   */
  factories?: FactoryProvider<unknown>[];

  /**
   * Constants provided by this module
   */
  constants?: ConstantProvider<unknown>[];
}

export interface ModuleMetadata<T = {}> extends Required<ModuleOption> {
  requires: Constructor[];
  onModuleCreate: (keyof T)[];
  onModuleDestroy: (keyof T)[];
}

const MODULE_REFLECT_SYMBOL: unique symbol = Symbol('MODULE_REFLECT_SYMBOL');

export function getModuleMetadata<T>(target: Constructor<T>): ModuleMetadata<T> {
  const result = Reflect.getMetadata(MODULE_REFLECT_SYMBOL, target);
  if (!result) {
    throw new Error(`"${target.name}"is not decorated with @Module annotation`);
  }
  return result;
}

export function setModuleMetadata<T>(module: Constructor<T>, metadata: ModuleMetadata<T>) {
  decorate(injectable(), module);

  for (const dependency of metadata.requires) {
    if (!Reflect.getMetadata(MODULE_REFLECT_SYMBOL, dependency)) {
      throw new Error(`Module "${module.name}" are depends on an invalid module "${dependency.name}"`);
    }
  }
  Reflect.defineMetadata(MODULE_REFLECT_SYMBOL, metadata, module);
}

// function moduleLifecycleFallback() {}

// ensureMethodInjectMetadata(moduleLifecycleFallback);

const ON_MODULE_CREATE = Symbol();
const ON_MODULE_DESTROY = Symbol();

/**
 * Return module lifecycle function for corresponding metadata key
 * @param constructor Constructor of a module
 * @param metadataKey Metadata key of lifecycle function, must be ON_MODULE_CREATE or ON_MODULE_CREATE
 */
function getModuleLifecycleMethod<T>(constructor: Constructor<T>, metadataKey: symbol): (keyof T)[] {
  const lifecycleMethods = Reflect.getMetadata(metadataKey, constructor.prototype);
  return Array.isArray(lifecycleMethods) ? lifecycleMethods : [];
}

/**
 * Decorator for marking a constructor as a module
 *
 * @param option
 * @decorator
 */
export function ModuleClass(option: ModuleOption = {}) {
  const requires = option.requires || [];
  const constants = option.constants ?? [];
  const components = option.components ?? [];
  const factories = option.factories ?? [];

  return <T extends {}>(constructor: Constructor<T>): Constructor<T> => {
    const onModuleCreate = getModuleLifecycleMethod(constructor, ON_MODULE_CREATE);
    const onModuleDestroy = getModuleLifecycleMethod(constructor, ON_MODULE_DESTROY);
    onModuleCreate.forEach((key) => ensureMethodInjectMetadata(constructor.prototype, key));
    onModuleDestroy.forEach((key) => ensureMethodInjectMetadata(constructor.prototype, key));
    setModuleMetadata(constructor, {
      requires,
      constants,
      factories,
      components,
      onModuleCreate,
      onModuleDestroy,
    });
    return constructor;
  };
}

function defineModuleLifecycleMetadata(metadataKey: symbol) {
  return <T extends {}>(prototype: T, name: keyof T, propertyDescriptor: PropertyDescriptor): void => {
    const value = propertyDescriptor.value;
    if (typeof value === 'function') {
      let lifecycleMethods = Reflect.getMetadata(metadataKey, prototype);
      if (!Array.isArray(lifecycleMethods)) {
        lifecycleMethods = [];
        Reflect.defineMetadata(metadataKey, lifecycleMethods, prototype);
      }
      lifecycleMethods.push(name);
    }
  };
}

/**
 * Decorator for marking a method function to be called when module is created
 */
export function OnModuleCreate() {
  return defineModuleLifecycleMetadata(ON_MODULE_CREATE);
}

/**
 * Decorator for marking a method function to be called when module is destroyed
 */
export function OnModuleDestroy() {
  return defineModuleLifecycleMetadata(ON_MODULE_DESTROY);
}

/**
 * Create an simple module for given module option
 * @param option
 */
export function createModule(option: ModuleOption = {}): Constructor {
  @ModuleClass(option)
  class Module {}

  return Module;
}
