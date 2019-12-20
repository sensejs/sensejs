import {
  BindingSpec,
  Class,
  ComponentFactory,
  ComponentMetadata,
  ComponentScope,
  ConstantProvider,
  Constructor,
  FactoryProvider,
} from './interfaces';
import {ContainerModule, decorate, injectable, interfaces} from 'inversify';
import {getComponentMetadata} from './component';
import {ensureMethodInjectMetadata} from './method-inject';
import {Deprecated} from './utils';

export interface ModuleOption {
  /**
   * Dependencies of this module, must be decorated
   */
  requires?: Constructor[];

  /**
   * Components provided by this module
   */
  components?: (Constructor | Class)[];

  factories?: FactoryProvider<unknown>[];

  constants?: ConstantProvider<unknown>[];
}

export interface ModuleMetadata {
  requires: Constructor[];
  containerModule: ContainerModule;
  onModuleCreate: Function;
  onModuleDestroy: Function;
}

const MODULE_REFLECT_SYMBOL: unique symbol = Symbol('MODULE_REFLECT_SYMBOL');

export function getModuleMetadata(target: Constructor): ModuleMetadata {
  const result = Reflect.getMetadata(MODULE_REFLECT_SYMBOL, target);
  if (!result) {
    throw new Error('target is not decorated with @Module annotation');
  }
  return result;
}

export function setModuleMetadata(module: Constructor, metadata: ModuleMetadata) {
  decorate(injectable(), module);

  for (const module of metadata.requires) {
    if (!Reflect.getMetadata(MODULE_REFLECT_SYMBOL, module)) {
      throw new Error('This module are requiring an invalid module');
    }
  }
  Reflect.defineMetadata(MODULE_REFLECT_SYMBOL, metadata, module);
}

function scopedBindingHelper<T>(
  binding: interfaces.BindingInSyntax<T>,
  scope: ComponentScope = ComponentScope.TRANSIENT,
): interfaces.BindingWhenOnSyntax<T> {
  switch (scope) {
    case ComponentScope.SINGLETON:
      return binding.inSingletonScope();
    case ComponentScope.REQUEST:
      return binding.inRequestScope();
    default:
      return binding.inTransientScope();
  }
}

function bindingHelper<T>(spec: BindingSpec, from: () => interfaces.BindingInSyntax<T>) {
  const result = scopedBindingHelper(from(), spec.scope);
  if (spec.name) {
    result.whenTargetNamed(spec.name);
  }
  if (spec.tags) {
    for (const {key, value} of spec.tags) {
      result.whenTargetTagged(key, value);
    }
  }
}

function createContainerModule(option: ModuleOption) {
  const components = option.components || [];
  const factories = option.factories || [];
  const constants = option.constants || [];
  return new ContainerModule((bind, unbind, isBound, rebind) => {
    constants.forEach((constantProvider) => {
      bind(constantProvider.provide).toConstantValue(constantProvider.value);
    });

    components.map(getComponentMetadata).map(async (metadata: ComponentMetadata<unknown>) => {
      const {target, id = target} = metadata;
      bindingHelper(metadata, () => bind(id).to(metadata.target));
    });

    factories.forEach((factoryProvider: FactoryProvider<unknown>) => {
      const {provide, factory, scope, ...rest} = factoryProvider;
      if (!isBound(factory)) {
        bindingHelper({scope}, () => bind(factory).toSelf());
      }
      bindingHelper(rest, () =>
        bind(provide).toDynamicValue((context: interfaces.Context) => {
          const factoryInstance = context.container.get<ComponentFactory<unknown>>(factory);
          return factoryInstance.build(context);
        }),
      );
    });
  });
}

function moduleLifecycleFallback() {}

ensureMethodInjectMetadata(moduleLifecycleFallback);

function ensureOnModuleCreate<T>(constructor: Constructor<T>) {

  const onModuleCreateMetadata = Reflect.getMetadata(ON_MODULE_CREATE, constructor.prototype);
  if (typeof onModuleCreateMetadata === 'undefined') {
    return moduleLifecycleFallback;
  }

  const onModuleCreate = constructor.prototype[onModuleCreateMetadata as keyof T];
  if (typeof onModuleCreate !== 'function') {
    throw new Error('@OnModuleCreate decorated function has been replaced by non-function value');
  }
  ensureMethodInjectMetadata(onModuleCreate);

  return onModuleCreate;
}

function ensureOnModuleDestroy<T>(constructor: Constructor<T>) {

  const onModulDestroyMetadata = Reflect.getMetadata(ON_MODULE_DESTROY, constructor.prototype);
  if (typeof onModulDestroyMetadata === 'undefined') {
    return moduleLifecycleFallback;
  }

  const onModuleDestroy = constructor.prototype[onModulDestroyMetadata as keyof T];
  if (typeof onModuleDestroy !== 'function') {
    throw new Error('@OnModuleDestroy decorated function has been replaced by non-function value');
  }
  ensureMethodInjectMetadata(onModuleDestroy);

  return onModuleDestroy;
}

export function ModuleClass(option: ModuleOption = {}) {

  const requires = option.requires || [];
  const containerModule = createContainerModule(option);

  return <T extends {}>(constructor: Constructor<T>) => {

    setModuleMetadata(constructor, {
      requires,
      containerModule,
      onModuleCreate: ensureOnModuleCreate(constructor),
      onModuleDestroy: ensureOnModuleDestroy(constructor),
    });
  };
}

const ON_MODULE_CREATE = Symbol();
const ON_MODULE_DESTROY = Symbol();

export function OnModuleCreate() {

  return <T extends {}>(
    prototype: T,
    name: keyof T,
    propertyDescriptor: PropertyDescriptor,
  ): void => {
    const func = propertyDescriptor.value;
    if (func) {
      if (Reflect.hasOwnMetadata(ON_MODULE_CREATE, prototype)) {
        throw new Error('Cannot apply @OnModuleCreate multiple times');
      }
      Reflect.defineMetadata(ON_MODULE_CREATE, name, prototype);
    }
  };
}

export function OnModuleDestroy() {

  return <T extends {}>(
    prototype: T,
    name: keyof T,
    propertyDescriptor: PropertyDescriptor,
  ): void => {
    const func = propertyDescriptor.value;
    if (func) {
      if (Reflect.hasOwnMetadata(ON_MODULE_DESTROY, prototype)) {
        throw new Error('Cannot apply @OnModuleDestroy multiple times');
      }
      Reflect.defineMetadata(ON_MODULE_DESTROY, name, prototype);
    }
  };
}

@Deprecated({message: 'Module() is deprecated. Use @ModuleClass to define module instead.'})
@injectable()
class LegacyModuleClass {
  async onCreate(): Promise<void> {}

  async onDestroy(): Promise<void> {}
}

export type ModuleConstructor = Constructor<LegacyModuleClass>;

/**
 * Create a module constructor
 * @param option
 * @deprecated Use ModuleClass decorator, or up comming createModule function instead
 */
export function Module(option: ModuleOption = {}): ModuleConstructor {
  const containerModule = createContainerModule(option);

  class Module extends LegacyModuleClass {}

  function onModuleCreate(this: LegacyModuleClass) {
    return this.onCreate();
  }

  function onModuleDestroy(this: LegacyModuleClass) {
    return this.onDestroy();
  }

  ensureMethodInjectMetadata(onModuleCreate);
  ensureMethodInjectMetadata(onModuleDestroy);
  setModuleMetadata(Module, {
    requires: option.requires || [],
    containerModule,
    onModuleCreate,
    onModuleDestroy,
  });
  return Module as ModuleConstructor;
}
