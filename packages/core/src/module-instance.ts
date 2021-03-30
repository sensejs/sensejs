import {BindingType, Container, Scope, ServiceId} from '@sensejs/container';
import {getModuleMetadata, ModuleMetadata} from './module';
import {invokeMethod} from './method-inject';
import {ComponentFactory, ComponentMetadata, Constructor, FactoryProvider} from './interfaces';
import {getComponentMetadata} from './component';

function bindComponent(container: Container, constructor: Constructor, metadata: ComponentMetadata) {
  const {target, id, bindParentConstructor} = metadata;
  container.add(constructor);
  if (id !== target) {
    container.addBinding({type: BindingType.ALIAS, id: id as ServiceId<any>, canonicalId: constructor});
  }

  if (!bindParentConstructor) {
    return;
  }

  let parentConstructor = Object.getPrototypeOf(target);
  while (parentConstructor.prototype) {
    container.addBinding({type: BindingType.ALIAS, id: parentConstructor, canonicalId: constructor});
    parentConstructor = Object.getPrototypeOf(parentConstructor);
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

  private bindComponents(option: ModuleMetadata<any>) {
    const {components, factories, constants} = option;
    constants.forEach((constantProvider) => {
      this.container.addBinding({
        type: BindingType.CONSTANT,
        value: constantProvider.value,
        id: constantProvider.provide,
      });
    });

    components.forEach((component) => {
      bindComponent(this.container, component, getComponentMetadata(component));
    });

    factories.forEach((factoryProvider: FactoryProvider<unknown>) => {
      const {provide, factory, scope = Scope.REQUEST, ...rest} = factoryProvider;
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

  private async performSetup() {
    this.container.add(this.moduleClass);
    this.bindComponents(this.moduleMetadata);
    this.moduleInstance = this.container.resolve<object>(this.moduleClass);
    for (const method of this.moduleMetadata.onModuleCreate) {
      await invokeMethod(this.container.createResolveContext(), this.moduleClass, method);
    }
  }

  private async performDestroy() {
    if (this.moduleInstance) {
      for (const method of this.moduleMetadata.onModuleDestroy.reverse()) {
        await invokeMethod(this.container.createResolveContext(), this.moduleClass, method);
      }
    }
  }
}
