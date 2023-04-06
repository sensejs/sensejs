import {ConstantProvider, Constructor, FactoryProvider} from './interfaces.js';
import {Injectable, InjectScope, Scope} from '@sensejs/container';
import {deprecate} from './utils/index.js';

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
  factories?: FactoryProvider[];

  /**
   * Constants provided by this module
   */
  constants?: ConstantProvider[];

  /**
   * Custom properties, useful for custom component discovery
   */
  properties?: object | null;
}

export interface ModuleMetadata<T = {}> extends Required<ModuleOption> {
  requires: Constructor[];
  dynamicComponents?: Constructor[];
  dynamicFactories?: FactoryProvider[];
  dynamicConstants?: ConstantProvider[];
  onModuleCreate: (keyof T)[];
  onModuleStart: (keyof T)[];
  onModuleStop: (keyof T)[];
  onModuleDestroy: (keyof T)[];
}

const MODULE_REFLECT_SYMBOL: unique symbol = Symbol('MODULE_REFLECT_SYMBOL');

/**
 * @private
 */
export function getModuleMetadata<T extends {}>(target: Constructor<T>): ModuleMetadata<T> {
  const result = Reflect.getOwnMetadata(MODULE_REFLECT_SYMBOL, target);
  if (!result) {
    throw new Error(`"${target.name}"is not decorated with @Module annotation`);
  }
  return result;
}

/**
 * @private
 */
export function setModuleMetadata<T extends {}>(module: Constructor<T>, metadata: ModuleMetadata<T>): void {
  Injectable()(module);

  for (const dependency of metadata.requires) {
    if (!Reflect.getMetadata(MODULE_REFLECT_SYMBOL, dependency)) {
      throw new Error(`Module "${module.name}" are depends on an invalid module "${dependency.name}"`);
    }
  }
  Reflect.defineMetadata(MODULE_REFLECT_SYMBOL, metadata, module);
}

const ON_MODULE_CREATE = Symbol();
const ON_MODULE_START = Symbol();
const ON_MODULE_STOP = Symbol();
const ON_MODULE_DESTROY = Symbol();

/**
 * Return module lifecycle function for corresponding metadata key
 * @param constructor Constructor of a module
 * @param metadataKey Metadata key of lifecycle function, must be ON_MODULE_CREATE or ON_MODULE_CREATE
 */
function getModuleLifecycleMethod<T extends {}>(constructor: Constructor<T>, metadataKey: symbol): (keyof T)[] {
  const lifecycleMethods = Reflect.getMetadata(metadataKey, constructor.prototype);
  return Array.isArray(lifecycleMethods) ? lifecycleMethods : [];
}

export interface ModuleClassDecorator {
  <T extends {}>(constructor: Constructor<T>): Constructor<T>;
}

export const ModuleClass = deprecate(
  function ModuleClass(option: ModuleOption = {}) {
    return Module(option);
  },
  {replacedBy: Module},
);
/**
 * Decorator for marking a constructor as a module
 *
 * @param option
 * @decorator
 */
export function Module(option: ModuleOption = {}): ModuleClassDecorator {
  return <T extends {}>(constructor: Constructor<T>): Constructor<T> => {
    const onModuleCreate = getModuleLifecycleMethod(constructor, ON_MODULE_CREATE);
    const onModuleStart = getModuleLifecycleMethod(constructor, ON_MODULE_START);
    const onModuleStop = getModuleLifecycleMethod(constructor, ON_MODULE_STOP);
    const onModuleDestroy = getModuleLifecycleMethod(constructor, ON_MODULE_DESTROY);
    const {requires = [], constants = [], factories = [], components = [], properties = []} = option;

    setModuleMetadata(constructor, {
      requires,
      constants,
      factories,
      components,
      properties,
      onModuleCreate,
      onModuleStart,
      onModuleStop,
      onModuleDestroy,
    });
    Injectable()(constructor);
    Scope(InjectScope.SINGLETON)(constructor);
    return constructor;
  };
}

export interface ModuleLifecycleMethodDecorator {
  <T extends {}>(prototype: T, name: keyof T, propertyDescriptor: PropertyDescriptor): void;
}

function defineModuleLifecycleMetadata(metadataKey: symbol): ModuleLifecycleMethodDecorator {
  return <T extends {}>(prototype: T, name: keyof T, propertyDescriptor: PropertyDescriptor): void => {
    const value = propertyDescriptor.value;
    if (typeof value === 'function') {
      let lifecycleMethods = Reflect.getOwnMetadata(metadataKey, prototype);
      if (!Array.isArray(lifecycleMethods)) {
        lifecycleMethods = Reflect.getMetadata(metadataKey, prototype) ?? [];
        Reflect.defineMetadata(metadataKey, lifecycleMethods, prototype);
      }
      lifecycleMethods.push(name);
    }
  };
}

/**
 * Decorator for marking a method function to be called when module is created
 */
export function OnModuleCreate(): ModuleLifecycleMethodDecorator {
  return defineModuleLifecycleMetadata(ON_MODULE_CREATE);
}
/**
 * Decorator for marking a method function to be called when all module has been loaded
 */
export function OnModuleStart(): ModuleLifecycleMethodDecorator {
  return defineModuleLifecycleMetadata(ON_MODULE_START);
}

/**
 * Decorator for marking a method function to be called when it's going to destroy all modules
 */
export function OnModuleStop(): ModuleLifecycleMethodDecorator {
  return defineModuleLifecycleMetadata(ON_MODULE_STOP);
}

/**
 * Decorator for marking a method function to be called when module is destroyed
 */
export function OnModuleDestroy(): ModuleLifecycleMethodDecorator {
  return defineModuleLifecycleMetadata(ON_MODULE_DESTROY);
}

/**
 * Create a simple module for given module option
 * @param option
 */
export function createModule(option: ModuleOption = {}): Constructor {
  // This way we keep its name to be "Module", without conflicting with Module decorator
  const module = class Module {};
  Module(option)(module);
  return module;
}

export class ModuleMetadataLoader {
  get(module: Constructor): ModuleMetadata {
    return getModuleMetadata(module);
  }
}
