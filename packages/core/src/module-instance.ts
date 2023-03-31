import {BindingType, Container, InjectScope, ServiceId} from '@sensejs/container';
import {ModuleMetadata, ModuleMetadataLoader} from './module.js';
import {invokeMethod} from './method-invoker.js';
import {ComponentFactory, ComponentMetadata, ConstantProvider, Constructor, FactoryProvider} from './interfaces.js';
import {getComponentMetadata} from './component.js';

function bindComponent(container: Container, constructor: Constructor, metadata: ComponentMetadata) {
  const {target, id} = metadata;
  container.add(constructor);
  if (id !== target) {
    container.addBinding({type: BindingType.ALIAS, id: id as ServiceId, canonicalId: constructor});
  }
}

export class DynamicModuleLoader {
  components: Constructor[] = [];
  factories: FactoryProvider[] = [];
  constants: ConstantProvider[] = [];

  addComponent(constructor: Constructor): this {
    this.components.push(constructor);
    return this;
  }

  addFactory(provider: FactoryProvider): this {
    this.factories.push(provider);
    return this;
  }

  addConstant(provider: ConstantProvider): this {
    this.constants.push(provider);
    return this;
  }

  getComponents(): Constructor[] {
    return this.components;
  }

  getConstants(): ConstantProvider[] {
    return this.constants;
  }

  getFactories(): FactoryProvider[] {
    return this.factories;
  }
}

/**
 * @private
 */
export class ModuleInstance<T extends {} = {}> {
  public readonly dependencies: ModuleInstance[] = [];
  public readonly moduleMetadata: ModuleMetadata<T>;
  public referencedCounter = 0;
  #isBootstrapped = false;
  #isStarted = false;
  #startPromise?: Promise<void>;
  #bootstrapPromise?: Promise<void>;
  #stopPromise?: Promise<void>;
  #destroyPromise?: Promise<void>;
  #moduleInstance?: any;

  constructor(
    readonly moduleClass: Constructor<T>,
    private readonly container: Container,
    loader: ModuleMetadataLoader = new ModuleMetadataLoader(),
    instanceMap: Map<Constructor, ModuleInstance<any>> = new Map(),
  ) {
    this.moduleMetadata = loader.get(this.moduleClass);
    instanceMap.set(moduleClass, this);
    this.moduleMetadata.requires.forEach((moduleClass) => {
      let dependency = instanceMap.get(moduleClass);
      if (!dependency) {
        dependency = new ModuleInstance(moduleClass, container, loader, instanceMap);
      }
      this.dependencies.push(dependency);
      dependency.referencedCounter++;
    });
  }

  async bootstrap(): Promise<void> {
    if (this.#bootstrapPromise) {
      return this.#bootstrapPromise;
    }
    this.#bootstrapPromise = this.#performBootstrap();
    return this.#bootstrapPromise;
  }

  async start(): Promise<void> {
    if (this.#startPromise) {
      return this.#startPromise;
    }
    this.#startPromise = this.#performStart();
    return this.#startPromise;
  }

  async stop(): Promise<void> {
    if (this.#stopPromise) {
      return this.#stopPromise;
    }
    this.#stopPromise = this.#startPromise
      ? this.#startPromise.catch(() => {}).then(() => this.#performStop())
      : Promise.resolve();
    return this.#stopPromise;
  }

  async destroy(): Promise<void> {
    if (!this.#bootstrapPromise) {
      return;
    }
    if (this.#destroyPromise) {
      return this.#destroyPromise;
    }
    this.#destroyPromise = (this.#startPromise ? this.#startPromise : this.#bootstrapPromise)
      .catch(() => {})
      .then(() => this.#performDestroy());
    return this.#destroyPromise;
  }

  #bindDynamicComponents(components: Constructor[]) {
    if (components.length <= 0) {
      return;
    }

    this.moduleMetadata.dynamicComponents = components;
    this.#bindComponents(components);
  }

  #bindDynamicFactories(providers: FactoryProvider[]) {
    if (providers.length <= 0) {
      return;
    }

    this.moduleMetadata.dynamicFactories = providers;
    this.#bindFactories(providers);
  }

  #bindDynamicConstants(providers: ConstantProvider[]) {
    if (providers.length <= 0) {
      return;
    }

    this.moduleMetadata.dynamicConstants = providers;
    this.#bindConstants(providers);
  }

  #bindComponents(components: Constructor[]) {
    components.forEach((component) => {
      bindComponent(this.container, component, getComponentMetadata(component));
    });
  }

  #bindFactories(factories: FactoryProvider[]) {
    factories.forEach((factoryProvider: FactoryProvider) => {
      const {provide, factory, scope = InjectScope.SESSION, ...rest} = factoryProvider;
      this.container.add(factory);
      this.container.addBinding({
        type: BindingType.FACTORY,
        id: provide,
        factory: (factory: ComponentFactory<any>) => {
          return factory.build();
        },
        paramInjectionMetadata: [{index: 0, id: factory, optional: false}],
        scope,
      });
    });
  }

  #bindConstants(constants: ConstantProvider[]) {
    constants.forEach((constantProvider) => {
      this.container.addBinding({
        type: BindingType.CONSTANT,
        value: constantProvider.value,
        id: constantProvider.provide,
      });
    });
  }

  async #performBootstrap() {
    this.container.add(this.moduleClass);
    this.#bindComponents(this.moduleMetadata.components);
    this.#bindConstants(this.moduleMetadata.constants);
    this.#bindFactories(this.moduleMetadata.factories);
    this.#moduleInstance = this.container.resolve<object>(this.moduleClass);
    const dynamicComponentLoader = new DynamicModuleLoader();
    for (const method of this.moduleMetadata.onModuleCreate) {
      await invokeMethod(
        this.container.createResolveSession().addTemporaryConstantBinding(DynamicModuleLoader, dynamicComponentLoader),
        this.moduleClass,
        method,
      );
    }
    this.#bindDynamicComponents(dynamicComponentLoader.getComponents());
    this.#bindDynamicConstants(dynamicComponentLoader.getConstants());
    this.#bindDynamicFactories(dynamicComponentLoader.getFactories());
    this.#isBootstrapped = true;
  }

  async #performStart() {
    await Promise.all(this.dependencies.map((x) => x.start()));
    await Promise.all(
      this.moduleMetadata.onModuleStart.map(async (method) => {
        await invokeMethod(this.container.createResolveSession(), this.moduleClass, method);
      }),
    );
    this.#isStarted = true;
  }

  async #performStop() {
    if (!this.#isStarted) {
      return;
    }
    await Promise.all(
      this.moduleMetadata.onModuleStop.map(async (method) => {
        await invokeMethod(this.container.createResolveSession(), this.moduleClass, method);
      }),
    );
    await Promise.all(this.dependencies.map((x) => x.stop()));
  }

  async #performDestroy() {
    if (!this.#isBootstrapped) {
      return;
    }
    if (this.#moduleInstance) {
      for (const method of this.moduleMetadata.onModuleDestroy.reverse()) {
        await invokeMethod(this.container.createResolveSession(), this.moduleClass, method);
      }
    }
  }
}
