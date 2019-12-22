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
import {ClassDecorator} from './utils';
import {ContainerModule, decorate, injectable, interfaces} from 'inversify';
import {getComponentMetadata} from './component';
import {ensureMethodInjectMetadata} from './method-inject';
import {Deprecated} from './utils';

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
  components?: (Constructor | Class)[];

  /**
   * Factories provided by this module
   */
  factories?: FactoryProvider<unknown>[];

  /**
   * Constants provided by this module
   */
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

const ON_MODULE_CREATE = Symbol();
const ON_MODULE_DESTROY = Symbol();

/**
 * Return module lifecycle function for corresponding metadata key
 * @param constructor Constructor of a module
 * @param metadataKey Metadata key of lifecycle function, must be ON_MODULE_CREATE or ON_MODULE_CREATE
 */
function getModuleLifecycleMethod<T>(constructor: Constructor<T>, metadataKey: symbol) {

  const onModuleCreateMetadata = Reflect.getMetadata(metadataKey, constructor.prototype);
  if (typeof onModuleCreateMetadata === 'undefined') {
    return moduleLifecycleFallback;
  }

  const onModuleCreate = constructor.prototype[onModuleCreateMetadata as keyof T];
  if (typeof onModuleCreate !== 'function') {
    return null;
  }
  ensureMethodInjectMetadata(onModuleCreate);
  return onModuleCreate;
}

/**
 * Decorator for marking a constructor as a module
 *
 * @param option
 * @decorator
 */
export function ModuleClass(option: ModuleOption = {}) {

  const requires = option.requires || [];
  const containerModule = createContainerModule(option);

  return <T extends {}>(constructor: Constructor<T>) => {

    const onModuleCreate = getModuleLifecycleMethod(constructor, ON_MODULE_CREATE);
    if (!onModuleCreate) {
      throw new Error('@OnModuleCreate decorated function has been replaced by non-function value');
    }
    const onModuleDestroy = getModuleLifecycleMethod(constructor, ON_MODULE_DESTROY);
    if (!onModuleDestroy) {
      throw new Error('@OnModuleDestroy decorated function has been replaced by non-function value');
    }
    setModuleMetadata(constructor, {
      requires,
      containerModule,
      onModuleCreate,
      onModuleDestroy,
    });
  };
}

function defineModuleLifecycleMetadata(decoratorName: string, metadataKey: symbol) {
  return <T extends {}>(
    prototype: T,
    name: keyof T,
    propertyDescriptor: PropertyDescriptor,
  ): void => {
    const func = propertyDescriptor.value;
    if (func) {
      if (Reflect.hasOwnMetadata(metadataKey, prototype)) {
        throw new Error(`Cannot apply @${decoratorName} multiple times`);
      }
      Reflect.defineMetadata(metadataKey, name, prototype);
    }
  };
}

/**
 * Decorator for marking a method function to be called when module is created
 */
export function OnModuleCreate() {
  return defineModuleLifecycleMetadata(OnModuleCreate.name, ON_MODULE_CREATE);
}

/**
 * Decorator for marking a method function to be called when module is destroyed
 */
export function OnModuleDestroy() {
  return defineModuleLifecycleMetadata(OnModuleCreate.name, ON_MODULE_DESTROY);
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

@Deprecated({message: 'Module() is deprecated. Use @ModuleClass to define module instead.'})
@injectable()
class LegacyModuleClass {
  async onCreate(): Promise<void> {}

  async onDestroy(): Promise<void> {}
}

/**
 * @deprecated
 */
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

export function createLegacyModule<T>(decorator: (option: T) => ClassDecorator<Constructor>, message: string) {
  return (option: T): ModuleConstructor => {
    @Deprecated({message})
    @decorator(option)
    class LegacyModule {
    }

    return Module({requires: [LegacyModule]});
  };
}
