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

function createContainerModule(option: ModuleMetadata) {
  const {components, factories, constants} = option;
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

/**
 * @private
 */
export class ModuleInstance {
  public readonly dependencies: ModuleInstance[] = [];
  public referencedCounter = 0;
  public readonly moduleMetadata: ModuleMetadata;
  private setupPromise?: Promise<void>;
  private destroyPromise?: Promise<void>;
  private moduleInstance?: any;
  private containerModule: ContainerModule;

  constructor(
    readonly moduleClass: Constructor,
    private readonly container: Container,
    instanceMap: Map<Constructor, ModuleInstance> = new Map(),
  ) {
    this.moduleMetadata = getModuleMetadata(this.moduleClass);
    this.containerModule = createContainerModule(this.moduleMetadata);
    if (typeof this.moduleMetadata === 'undefined') {
      throw new Error('Target is not a module');
    }
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

  async onSetup() {
    if (this.setupPromise) {
      return this.setupPromise;
    }
    this.setupPromise = this.performSetup();
    return this.setupPromise;
  }

  async onDestroy() {
    if (this.destroyPromise) {
      return this.destroyPromise;
    }
    this.destroyPromise = this.performDestroy();
    return this.destroyPromise;
  }

  private async performSetup() {
    this.container
      .bind(this.moduleClass)
      .toSelf()
      .inSingletonScope();
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
