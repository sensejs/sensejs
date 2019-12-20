import {Container} from 'inversify';
import {getModuleMetadata, ModuleMetadata} from './module';
import {ModuleInstance} from './module-instance';
import {Constructor} from './interfaces';

export class ModuleRoot {
  private readonly container: Container = new Container({skipBaseClassChecks: true});
  private readonly moduleInstanceMap: Map<Constructor, ModuleInstance> = new Map();
  private readonly moduleDependencyMap: Map<Constructor, Constructor[]> = new Map();
  private readonly moduleReferencedMap: Map<Constructor, Constructor[]> = new Map();

  public constructor(private entryModule: Constructor) {
    this.container.bind(Container).toConstantValue(this.container);
    this.analyzeDependency(this.entryModule, getModuleMetadata(this.entryModule));
    // this.buildDependencyAndReference();
  }

  public async start() {
    await this.startModule(this.entryModule);
  }

  public async stop(): Promise<void> {
    await Promise.all(Array.from(this.moduleInstanceMap.values()).map((module) => this.stopModule(module)));
  }

  private analyzeDependency(target: Constructor, metadata: ModuleMetadata) {
    if (!this.moduleDependencyMap.has(target)) {
      this.moduleDependencyMap.set(target, metadata.requires);
      metadata.requires.forEach((module) => {
        this.analyzeDependency(module, getModuleMetadata(module));
        this.moduleReferencedMap.set(module, [target].concat(this.moduleReferencedMap.get(module) ?? []));
      });
    }
  }

  private async startModule(module: Constructor) {
    let moduleInstance = this.moduleInstanceMap.get(module);
    if (!moduleInstance) {
      moduleInstance = new ModuleInstance(module, this.container);
      this.moduleInstanceMap.set(module, moduleInstance);
      const dependencies = this.moduleDependencyMap.get(module);
      if (dependencies) {
        for (const dependency of dependencies) {
          await this.startModule(dependency);
        }
      }
    }
    await moduleInstance.onSetup();
  }

  private async stopModule(moduleInstance: ModuleInstance) {
    const referencedModules = this.moduleReferencedMap.get(moduleInstance.moduleClass);
    if (referencedModules) {
      await Promise.all(
        referencedModules
          .map((module) => this.moduleInstanceMap.get(module)!)
          .map((module) => this.stopModule(module)),
      );
    }
    await moduleInstance.onDestroy();
  }
}
