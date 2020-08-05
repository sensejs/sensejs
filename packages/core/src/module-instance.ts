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

function createContainerModule<T>(option: ModuleMetadata<T>) {
  const {components, factories, constants} = option;
  return new ContainerModule((bind) => {
    constants.forEach((constantProvider) => {
      bind(constantProvider.provide).toConstantValue(constantProvider.value);
    });

    components.map(getComponentMetadata).map(async (metadata: ComponentMetadata) => {
      const {target, id = target} = metadata;
      const constructMetadata = getConstructorInjectMetadata(target);
      const proxy = createConstructorArgumentTransformerProxy(target, constructMetadata);
      bindingHelper(metadata, () => bind(id).to(proxy));
    });

    factories.forEach((factoryProvider: FactoryProvider<unknown>) => {
      const {provide, factory, scope, ...rest} = factoryProvider;
      const constructMetadata = getConstructorInjectMetadata(factory);
      const proxy = createConstructorArgumentTransformerProxy(factory, constructMetadata);
      bindingHelper({scope}, () => bind(factory).to(proxy));
      bindingHelper(rest, () =>
        bind(provide).toDynamicValue((context: interfaces.Context) => {
          const factoryInstance = context.container.get<ComponentFactory<unknown>>(factory);
          return factoryInstance.build(context);
        }),
      );
    });
  });
}

/**
 * @private
 */
export class ModuleInstance<T extends {} = {}> {
  public readonly dependencies: ModuleInstance[] = [];
  public readonly moduleMetadata: ModuleMetadata<T>;
  public referencedCounter = 0;
  private readonly containerModule: ContainerModule;
  private setupPromise?: Promise<void>;
  private destroyPromise?: Promise<void>;
  private moduleInstance?: any;

  constructor(
    readonly moduleClass: Constructor<T>,
    private readonly container: Container,
    instanceMap: Map<Constructor, ModuleInstance<any>> = new Map(),
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

  invokeMethod<K extends keyof T>(
    container: Container,
    method: keyof T,
  ): T[K] extends (...args: any[]) => infer R ? R : never {
    return invokeMethod(container, this.moduleClass, method, this.moduleInstance);
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
      await invokeMethod(this.container, this.moduleClass, method, this.moduleInstance);
    }
  }

  private async performDestroy() {
    if (this.moduleInstance) {
      for (const method of this.moduleMetadata.onModuleDestroy.reverse()) {
        await invokeMethod(this.container, this.moduleClass, method, this.moduleInstance);
      }
    }
    this.container.unload(this.containerModule);
  }
}
