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
import {AsyncContainerModule, ContainerModule, decorate, injectable, interfaces} from 'inversify';
import {getComponentMetadata} from './component';
import {ensureMethodInjectMetadata} from './method-inject';

@injectable()
export class ModuleClass {
  async onCreate(): Promise<void> {}

  async onDestroy(): Promise<void> {}
}

export type ModuleConstructor = Constructor<ModuleClass>;

export interface ModuleOption {
  /**
   * Dependencies of this module, must be decorated
   */
  requires?: ModuleConstructor[];

  /**
   * Components provided by this module
   */
  components?: (Constructor | Class)[];

  factories?: FactoryProvider<unknown>[];

  constants?: ConstantProvider<unknown>[];
}

export interface ModuleMetadata {
  requires: ModuleConstructor[];
  containerModule: ContainerModule;
  onModuleCreate?: Function;
  onModuleDestroy?: Function;
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

export function ModuleDecorator(spec: ModuleOption) {

  const components = spec.components || [];
  const factories = spec.factories || [];
  const constants = spec.constants || [];
  const requires = spec.requires || [];
  const containerModule = new ContainerModule((bind, unbind, isBound, rebind) => {
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

  return <T extends {}>(constructor: Constructor<T>) => {
    const methods = Object.entries(Object.getOwnPropertyDescriptors(constructor.prototype))
      .map(([, pd]) => pd.value)
      .filter((value) => typeof value === 'function');
    const onModuleCreateDecorated = methods.filter((func) => Reflect.hasOwnMetadata(ON_MODULE_CREATE, func));
    const onModuleDestroyDecorated = methods.filter((func) => Reflect.hasOwnMetadata(ON_MODULE_CREATE, func));

    if (onModuleCreateDecorated.length > 1) {
      throw new Error('Multiple @OnModuleCreate applied to this module');
    }

    if (onModuleDestroyDecorated.length > 1) {
      throw new Error('Multiple @OnModuleDestroy applied to this module');
    }

    setModuleMetadata(constructor, {
      requires,
      containerModule,
      onModuleCreate: onModuleCreateDecorated[0],
      onModuleDestroy: onModuleDestroyDecorated[0],
    });
  };
}

interface ModuleLifecycle {
  <T extends {}>(this: T): void | Promise<void>;
}

const ON_MODULE_CREATE = Symbol();
const ON_MODULE_DESTROY = Symbol();

export function OnModuleCreate() {

  return <T extends {}>(
    prototype: T,
    name: keyof T,
    propertyDescriptor: TypedPropertyDescriptor<ModuleLifecycle>,
  ) => {
    const func = propertyDescriptor.value;
    if (func) {
      if (Reflect.hasOwnMetadata(ON_MODULE_CREATE, func)) {
        throw new Error('Cannot apply @OnModuleCreate multiple times');
      }
      Reflect.defineMetadata(ON_MODULE_CREATE, undefined, func);
      ensureMethodInjectMetadata(func);
    }
  };
}

export function OnModuleDestroy() {

  return <T extends {}>(
    prototype: T,
    name: keyof T,
    propertyDescriptor: TypedPropertyDescriptor<ModuleLifecycle>,
  ) => {
    const func = propertyDescriptor.value;
    if (func) {
      if (Reflect.hasOwnMetadata(ON_MODULE_CREATE, func)) {
        throw new Error('Cannot apply @OnModuleDestroy multiple times');
      }
      Reflect.defineMetadata(ON_MODULE_DESTROY, undefined, func);
      ensureMethodInjectMetadata(func);
    }
  };
}

export function Module(spec: ModuleOption = {}): ModuleConstructor {
  const components = spec.components || [];
  const factories = spec.factories || [];
  const constants = spec.constants || [];

  const containerModule = new AsyncContainerModule(async (bind, unbind, isBound, rebind) => {
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

  const moduleConstructor: ModuleConstructor = class extends ModuleClass {};

  function onModuleCreate(this: ModuleClass) {
    return this.onCreate();
  }

  function onModuleDestroy(this: ModuleClass) {
    return this.onDestroy();
  }

  ensureMethodInjectMetadata(onModuleCreate);
  ensureMethodInjectMetadata(onModuleDestroy);
  setModuleMetadata(moduleConstructor, {
    requires: spec.requires || [],
    containerModule,
    onModuleCreate,
    onModuleDestroy,
  });
  return moduleConstructor;
}
