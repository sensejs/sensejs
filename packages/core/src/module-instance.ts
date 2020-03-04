import {Container} from 'inversify';
import {getModuleMetadata, ModuleMetadata} from './module';
import {invokeMethod} from './method-inject';
import {Constructor} from './interfaces';

/**
 * @private
 */
export class ModuleInstance {
  public readonly dependencies: ModuleInstance[] = [];
  public referencedCounter = 0;
  private readonly moduleMetadata: ModuleMetadata;
  private setupPromise?: Promise<void>;
  private destroyPromise?: Promise<void>;
  private moduleInstance?: any;

  constructor(
    readonly moduleClass: Constructor,
    private readonly container: Container,
    instanceMap: Map<Constructor, ModuleInstance> = new Map(),
  ) {
    this.moduleMetadata = getModuleMetadata(this.moduleClass);
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
    this.container.load(this.moduleMetadata.containerModule);
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
    this.container.unload(this.moduleMetadata.containerModule);
  }
}
