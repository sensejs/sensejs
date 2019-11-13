import {Container} from 'inversify';
import {getModuleMetadata, ModuleClass, ModuleConstructor, ModuleMetadata} from './module';

/**
 * @private
 */
export class ModuleInstance {
  private setupPromise?: Promise<void>;
  private destroyPromise?: Promise<void>;
  private moduleLifecycle?: ModuleClass;
  private moduleMetadata: ModuleMetadata = getModuleMetadata(this.moduleClass);

  constructor(readonly moduleClass: ModuleConstructor, private readonly container: Container) {}

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
    await this.container.loadAsync(this.moduleMetadata.containerModule);
    this.moduleLifecycle = this.container.get(this.moduleClass);
    await this.moduleLifecycle!.onCreate();
  }

  private async performDestroy() {
    if (this.moduleLifecycle) {
      await this.moduleLifecycle.onDestroy();
    }
    this.container.unload(this.moduleMetadata.containerModule);
  }
}
