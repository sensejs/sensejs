import {
  Abstract,
  BindingSpec,
  ComponentFactory,
  ComponentMetadata,
  ComponentScope,
  ConstantProvider,
  Constructor,
  FactoryProvider,
} from './interfaces';
import {AsyncContainerModule, decorate, injectable, interfaces} from 'inversify';
import {getComponentMetadata} from './component';

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
  components?: (Constructor<unknown> | Abstract<unknown>)[];

  factories?: FactoryProvider<unknown>[];

  constants?: ConstantProvider<unknown>[];
}

export interface ModuleMetadata {
  requires: ModuleConstructor[];
  containerModule: AsyncContainerModule;
}

const MODULE_REFLECT_SYMBOL: unique symbol = Symbol('MODULE_REFLECT_SYMBOL');

export function getModuleMetadata(target: ModuleConstructor): ModuleMetadata {
  const result = Reflect.getMetadata(MODULE_REFLECT_SYMBOL, target);
  if (!result) {
    throw new Error('target is not decorated with @Module annotation');
  }
  return result;
}

export function setModuleMetadata(module: ModuleConstructor, metadata: ModuleMetadata) {
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

  setModuleMetadata(moduleConstructor, {
    requires: spec.requires || [],
    containerModule,
  });
  return moduleConstructor;
}
