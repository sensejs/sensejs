import {Container} from 'inversify';
import {getModuleMetadata, ModuleConstructor} from './module';
import {ModuleInstance} from './module-instance';

export class ApplicationFactory {
  private readonly container: Container = new Container({skipBaseClassChecks: true});
  private readonly moduleInstanceMap: Map<ModuleConstructor, ModuleInstance> = new Map();
  private readonly moduleDependencyMap: Map<ModuleConstructor, ModuleConstructor[]> = new Map();
  private readonly moduleReferencedMap: Map<ModuleConstructor, ModuleConstructor[]> = new Map();

  public constructor(private entryModule: ModuleConstructor) {
    this.container
      .bind(Container)
      .toDynamicValue(() => this.container.createChild())
      .inRequestScope();

    const moduleClasses = [entryModule];

    for (;;) {
      const moduleClass = moduleClasses.shift();
      if (!moduleClass) {
        return;
      }

      const moduleMetadata = getModuleMetadata(moduleClass);
      const moduleDependencies = moduleMetadata.requires || [];

      for (const dependencyModuleClass of moduleDependencies) {
        if (this.moduleDependencyMap.get(dependencyModuleClass)) {
          continue;
        }
        if (moduleClasses.indexOf(dependencyModuleClass) < 0) {
          moduleClasses.push(dependencyModuleClass);
        }
        let referencedModules = this.moduleReferencedMap.get(dependencyModuleClass);

        if (referencedModules === undefined) {
          referencedModules = [];
          this.moduleReferencedMap.set(dependencyModuleClass, referencedModules);
        }

        if (referencedModules.indexOf(moduleClass) < 0) {
          referencedModules.push(moduleClass);
        }
      }
      this.moduleDependencyMap.set(moduleClass, moduleDependencies);
    }
  }

  public start() {
    const startModule = async (module: ModuleConstructor) => {
      let moduleInstance = this.moduleInstanceMap.get(module);
      if (!moduleInstance) {
        moduleInstance = new ModuleInstance(module, this.container);
        this.moduleInstanceMap.set(module, moduleInstance);
        const dependencies = this.moduleDependencyMap.get(module);
        if (dependencies) {
          await Promise.all(dependencies.map(startModule));
        }
      }
      return moduleInstance.onSetup();
    };

    return startModule(this.entryModule);
  }

  public async stop() {
    const stopModule = async (moduleInstance: ModuleInstance) => {
      const referencedModules = this.moduleReferencedMap.get(moduleInstance.moduleClass);
      if (referencedModules) {
        await Promise.all(
          referencedModules
            .map((module) => this.moduleInstanceMap.get(module))
            .map((module) => module && stopModule(module)),
        );
      }
      await moduleInstance.onDestroy();
    };

    return Promise.all(Array.from(this.moduleInstanceMap.values()).map(stopModule));
  }
}
