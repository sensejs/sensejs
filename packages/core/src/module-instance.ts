import {Container, ContainerModule, interfaces} from 'inversify';
import {getModuleMetadata, ModuleMetadata} from './module';
import {invokeMethod} from './method-inject';
import {
  BindingSpec,
  ComponentFactory,
  ComponentMetadata,
  ComponentScope,
  Constructor,
  FactoryProvider,
  ServiceIdentifier,
} from './interfaces';
import {getComponentMetadata} from './component';
import {createConstructorArgumentTransformerProxy, getConstructorInjectMetadata} from './constructor-inject';

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

function constraintBindingHelper<T>(spec: BindingSpec, binding: interfaces.BindingWhenOnSyntax<T>) {
  if (spec.name) {
    binding.whenTargetNamed(spec.name);
  }
  if (spec.tags) {
    for (const {key, value} of spec.tags) {
      binding.whenTargetTagged(key, value);
    }
  }
  return binding;
}

function aliasBindingHelper<T>(
  bind: interfaces.Bind,
  metadata: ComponentMetadata<T>,
  target: ServiceIdentifier<T>,
  symbol: symbol,
) {
  const binding = bind(target).toDynamicValue((context) => {
    let result = metadata.cache.get(context);
    if (!result) {
      result = context.container.get<T>(symbol);
      metadata.cache.set(context, result);
    }
    return result;
  });
  constraintBindingHelper(metadata, binding);
}

function bindComponent(bind: interfaces.Bind, constructor: Constructor, metadata: ComponentMetadata) {
  const {target, id, scope} = metadata;
  const symbol = Symbol();
  const binding = bind(symbol).to(constructor);
  scopedBindingHelper(binding, scope);
  aliasBindingHelper(bind, metadata, target, symbol);

  if (id && target !== id) {
    aliasBindingHelper(bind, metadata, id, symbol);
  }

  let parentConstructor = Object.getPrototypeOf(target);
  while (parentConstructor.prototype) {
    aliasBindingHelper(bind, metadata, parentConstructor, symbol);
    parentConstructor = Object.getPrototypeOf(parentConstructor);
  }
}

function createContainerModule(option: ModuleMetadata) {
  const {components, factories, constants} = option;
  return new ContainerModule((bind) => {
    constants.forEach((constantProvider) => {
      bind(constantProvider.provide).toConstantValue(constantProvider.value);
    });

    components.forEach((component) => {
      const constructor = createConstructorArgumentTransformerProxy(component, getConstructorInjectMetadata(component));
      bindComponent(bind, constructor, getComponentMetadata(component));
    });

    factories.forEach((factoryProvider: FactoryProvider<unknown>) => {
      const {provide, factory, scope, ...rest} = factoryProvider;
      const constructMetadata = getConstructorInjectMetadata(factory);
      const proxy = createConstructorArgumentTransformerProxy(factory, constructMetadata);
      const factoryBinding = bind(factory).to(proxy);
      scopedBindingHelper(factoryBinding, scope);
      const targetBinding = bind(provide).toDynamicValue((context: interfaces.Context) => {
        const factoryInstance = context.container.get<ComponentFactory<unknown>>(factory);
        return factoryInstance.build(context);
      });
      constraintBindingHelper(rest, targetBinding);
    });
  });
}

/**
 * @private
 */
export class ModuleInstance {
  public readonly dependencies: ModuleInstance[] = [];
  public readonly moduleMetadata: ModuleMetadata;
  public referencedCounter = 0;
  private readonly containerModule: ContainerModule;
  private setupPromise?: Promise<void>;
  private destroyPromise?: Promise<void>;
  private moduleInstance?: any;

  constructor(
    readonly moduleClass: Constructor,
    private readonly container: Container,
    instanceMap: Map<Constructor, ModuleInstance> = new Map(),
  ) {
    this.moduleMetadata = getModuleMetadata(this.moduleClass);
    this.containerModule = createContainerModule(this.moduleMetadata);
    instanceMap.set(moduleClass, this);
    this.moduleMetadata.requires.forEach((moduleClass) => {
      let dependency = instanceMap.get(moduleClass);
      if (!dependency) {
        dependency = new ModuleInstance(moduleClass, container, instanceMap);
      }
      this.dependencies.push(dependency);
      dependency.referencedCounter++;
    });
  }

  async onSetup(): Promise<void> {
    if (this.setupPromise) {
      return this.setupPromise;
    }
    this.setupPromise = this.performSetup();
    return this.setupPromise;
  }

  async onDestroy(): Promise<void> {
    if (this.destroyPromise) {
      return this.destroyPromise;
    }
    this.destroyPromise = this.performDestroy();
    return this.destroyPromise;
  }

  private async performSetup() {
    const injectMetadata = getConstructorInjectMetadata(this.moduleClass);
    const proxy = createConstructorArgumentTransformerProxy(this.moduleClass, injectMetadata);
    this.container.bind(this.moduleClass).to(proxy).inSingletonScope();
    this.container.load(this.containerModule);
    this.moduleInstance = this.container.get<object>(this.moduleClass);
    for (const method of this.moduleMetadata.onModuleCreate) {
      if (typeof method === 'function') {
        await invokeMethod(this.container, this.moduleInstance, method);
      }
    }
  }

  private async performDestroy() {
    if (this.moduleInstance) {
      for (const method of this.moduleMetadata.onModuleDestroy.reverse()) {
        if (typeof method === 'function') {
          await invokeMethod(this.container, this.moduleInstance, method);
        }
      }
    }
    this.container.unload(this.containerModule);
  }
}
