import {BindingType, Container, InjectScope, ServiceId} from '@sensejs/container';
import {getModuleMetadata, ModuleMetadata} from './module';
import {invokeMethod} from './method-invoker';
import {ComponentFactory, ComponentMetadata, ConstantProvider, Constructor, FactoryProvider} from './interfaces';
import {getComponentMetadata} from './component';

function bindComponent(container: Container, constructor: Constructor, metadata: ComponentMetadata) {
  const {target, id, bindParentConstructor} = metadata;
  container.add(constructor);
  if (id !== target) {
    container.addBinding({type: BindingType.ALIAS, id: id as ServiceId, canonicalId: constructor});
  }

  if (!bindParentConstructor) {
    return;
  }

  let parentConstructor = Object.getPrototypeOf(target);
  while (parentConstructor.prototype) {
    if (parentConstructor !== id) {
      container.addBinding({type: BindingType.ALIAS, id: parentConstructor, canonicalId: constructor});
    }
    parentConstructor = Object.getPrototypeOf(parentConstructor);
  }
}

export class DynamicModuleLoader {
  components: Constructor[] = [];
  factories: FactoryProvider<any>[] = [];
  constants: ConstantProvider<any>[] = [];

  addComponent(constructor: Constructor): this {
    this.components.push(constructor);
    return this;
  }

  addFactory(provider: FactoryProvider<any>): this {
    this.factories.push(provider);
    return this;
  }

  addConstant(provider: ConstantProvider<any>): this {
    this.constants.push(provider);
    return this;
  }

  getComponents(): Constructor[] {
    return this.components;
  }

  getConstants(): ConstantProvider<any>[] {
    return this.constants;
  }

  getFactories(): FactoryProvider<any>[] {
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
  private setupPromise?: Promise<void>;
  private destroyPromise?: Promise<void>;
  private moduleInstance?: any;

  constructor(
    readonly moduleClass: Constructor<T>,
    private readonly container: Container,
    instanceMap: Map<Constructor, ModuleInstance<any>> = new Map(),
  ) {
    this.moduleMetadata = getModuleMetadata(this.moduleClass);
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

  invokeMethod<K extends keyof T>(container: Container, method: keyof T) {
    return invokeMethod(container.createResolveContext(), this.moduleClass, method);
  }

  async onDestroy(): Promise<void> {
    if (this.destroyPromise) {
      return this.destroyPromise;
    }
    this.destroyPromise = this.performDestroy();
    return this.destroyPromise;
  }

  private bindDynamicComponents(components: Constructor[]) {
    if (components.length <= 0) {
      return;
    }

    this.moduleMetadata.dynamicComponents = components;
    this.bindComponents(components);
  }

  private bindDynamicFactories(providers: FactoryProvider<any>[]) {
    if (providers.length <= 0) {
      return;
    }

    this.moduleMetadata.dynamicFactories = providers;
    this.bindFactories(providers);
  }

  private bindDynamicConstants(providers: ConstantProvider<any>[]) {
    if (providers.length <= 0) {
      return;
    }

    this.moduleMetadata.dynamicConstants = providers;
    this.bindConstants(providers);
  }

  private bindComponents(components: Constructor[]) {
    components.forEach((component) => {
      bindComponent(this.container, component, getComponentMetadata(component));
    });
  }

  private bindFactories(factories: FactoryProvider<unknown>[]) {
    factories.forEach((factoryProvider: FactoryProvider<unknown>) => {
      const {provide, factory, scope = InjectScope.REQUEST, ...rest} = factoryProvider;
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

  private bindConstants(constants: ConstantProvider<unknown>[]) {
    constants.forEach((constantProvider) => {
      this.container.addBinding({
        type: BindingType.CONSTANT,
        value: constantProvider.value,
        id: constantProvider.provide,
      });
    });
  }

  private async performSetup() {
    this.container.add(this.moduleClass);
    this.bindComponents(this.moduleMetadata.components);
    this.bindConstants(this.moduleMetadata.constants);
    this.bindFactories(this.moduleMetadata.factories);
    this.moduleInstance = this.container.resolve<object>(this.moduleClass);
    const dynamicComponentLoader = new DynamicModuleLoader();
    for (const method of this.moduleMetadata.onModuleCreate) {
      await invokeMethod(
        this.container.createResolveContext().addTemporaryConstantBinding(DynamicModuleLoader, dynamicComponentLoader),
        this.moduleClass,
        method,
      );
    }
    this.bindDynamicComponents(dynamicComponentLoader.getComponents());
    this.bindDynamicConstants(dynamicComponentLoader.getConstants());
    this.bindDynamicFactories(dynamicComponentLoader.getFactories());
  }

  private async performDestroy() {
    if (this.moduleInstance) {
      for (const method of this.moduleMetadata.onModuleDestroy.reverse()) {
        await invokeMethod(this.container.createResolveContext(), this.moduleClass, method);
      }
    }
  }
}
