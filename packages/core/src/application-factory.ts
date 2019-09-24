import {Container} from 'inversify';
import {getModuleMetadata} from './module';
import {Constructor} from './interfaces';
import {ModuleInstance} from './module-instance';


export class ApplicationFactory {

    private readonly container: Container = new Container({skipBaseClassChecks: true});
    private readonly moduleInstanceMap: Map<Constructor<unknown>, ModuleInstance> = new Map();
    private readonly moduleDependencyMap: Map<Constructor<unknown>, Constructor<unknown>[]> = new Map();
    private readonly moduleReferencedMap: Map<Constructor<unknown>, Constructor<unknown>[]> = new Map();


    public static async create(module: Constructor<unknown>) {

    }

    public constructor(private entryModule: Constructor<unknown>) {

        const moduleClasses = [entryModule];

        for (; ;) {
            const moduleClass = moduleClasses.shift();
            if (!moduleClass) {
                return;
            }

            const moduleMetadata = getModuleMetadata(moduleClass);
            const moduleDependencies = moduleMetadata.requires || [];

            for (const dependencyModuleClass of moduleDependencies) {
                if (this.moduleDependencyMap.get(dependencyModuleClass)) {
                    throw new Error('Circle dependency detected');
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
            // this.container.bind(moduleClass).to(moduleClass).inSingletonScope();
        }

    }

    public start() {

        const startModule = async (module: Constructor<unknown>) => {

            let moduleInstance = this.moduleInstanceMap.get(module);
            if (!moduleInstance) {

                const dependencies = this.moduleDependencyMap.get(module);
                if (dependencies) {
                    await Promise.all(dependencies.map(module => startModule(module)));
                }
                moduleInstance = new ModuleInstance(module, this.container);
                this.moduleInstanceMap.set(module, moduleInstance);
            }
            return moduleInstance.onSetup();
        };

        return startModule(this.entryModule);
    }

    public stop() {
        const stopModule = async (moduleInstance: ModuleInstance) => {

            // let moduleContext = this.moduleContextMap.get(module);
            const referencedModules = this.moduleReferencedMap.get(moduleInstance.moduleClass);
            if (referencedModules) {
                await Promise.all(referencedModules
                    .map((module) => this.moduleInstanceMap.get(module))
                    .map(module => module && stopModule(module)));
            }
            await moduleInstance.onDestroy();
        };

        return Promise.all(Array.from(this.moduleInstanceMap.values()).map(stopModule));


    }


}
