import {Container} from 'inversify';
import {ModuleInstance} from './module-instance';
import {Constructor} from './interfaces';

/**
 * @private
 */
export class ModuleRoot {
  readonly container: Container = new Container({skipBaseClassChecks: true});
  private readonly moduleInstanceMap: Map<Constructor, ModuleInstance> = new Map();
  private readonly entryModuleInstance: ModuleInstance;

  public constructor(entryModule: Constructor) {
    this.container.bind(Container).toConstantValue(this.container);
    this.entryModuleInstance = new ModuleInstance(entryModule, this.container, this.moduleInstanceMap);
  }

  public async start() {
    await this.startModule(this.entryModuleInstance);
  }

  public async stop(): Promise<void> {
    await this.stopModule(this.entryModuleInstance);
  }

  private async startModule(moduleInstance: ModuleInstance) {
    for (const dependency of moduleInstance.dependencies) {
      await this.startModule(dependency);
    }
    await moduleInstance.onSetup();
  }

  private async stopModule(moduleInstance: ModuleInstance) {
    if (--moduleInstance.referencedCounter > 0) {
      return;
    }
    await moduleInstance.onDestroy();
    for (; ;) {
      const dependency = moduleInstance.dependencies.pop();
      if (!dependency) {
        return;
      }
      await this.stopModule(dependency);
    }
  }
}
