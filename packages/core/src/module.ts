import {Abstract, Constructor} from './interfaces';
import {AsyncContainerModule, Container, decorate, injectable} from 'inversify';
import {getComponentMetadata} from './component';


export interface ModuleClass {
    // readonly container: Container;

    onCreate(container: Container): Promise<void>;

    onDestroy(container: Container): Promise<void>;
}

export type ModuleConstructor = Constructor<ModuleClass>;

export interface ModuleOption {
    /**
     * Dependencies of this module, must be decorated
     */
    requires?: ModuleConstructor[],

    /**
     * Components provided by this module
     */
    components?: (Constructor<unknown> | Abstract<unknown>)[]
}

export interface ModuleMetadata {
    requires: ModuleConstructor[];
    components: (Constructor<unknown> | Abstract<unknown>)[];
    moduleLifecycleFactory: (container: Container) => ModuleLifecycle;
}

export class ModuleLifecycle {

    protected containerModule?: AsyncContainerModule;

    constructor(protected readonly container: Container) {

    }

    /**
     * Specify how a component add its components
     * @param componentList
     */
    async onCreate(componentList: (Constructor<unknown> | Abstract<unknown>)[]) {
        this.containerModule = new AsyncContainerModule(async (bind, unbind, isBound, rebind) => {
            await Promise.all(
                componentList
                    .map(getComponentMetadata)
                    .map(metadata => metadata.onBind(bind, unbind, isBound, rebind)));
        });
        return this.container.loadAsync(this.containerModule);
    }

    async onDestroy() {
        if (this.containerModule) {
            this.container.unload(this.containerModule);
        }
    }
}


const MODULE_REFLECT_SYMBOL: unique symbol = Symbol('MODULE_REFLECT_SYMBOL');

export function getModuleMetadata(target: ModuleConstructor): ModuleMetadata {
    const result = Reflect.getMetadata(MODULE_REFLECT_SYMBOL, target);
    if (!result) {
        throw new Error('target is not decorated with @Module annotation');
    }
    return result;
}

export function setModuleMetadata(module: ModuleConstructor, metadata: ModuleMetadata) {

    decorate(injectable(), module);

    for (const module of metadata.requires) {
        if (!Reflect.getMetadata(MODULE_REFLECT_SYMBOL, module)) {
            throw new Error('This module are requiring an invalid module');
        }
    }

    for (const component of metadata.components) {
        if (typeof component === 'function') {
            // Check whether component
            getComponentMetadata(component);
        }
    }
    Reflect.defineMetadata(MODULE_REFLECT_SYMBOL, metadata, module);
}


export function Module(spec: ModuleOption = {}): ModuleConstructor {
    const componentList = spec.components || [];
    const containerModule = new AsyncContainerModule(async (bind, unbind, isBound, rebind) => {
        await Promise.all(
            componentList
                .map(getComponentMetadata)
                .map(metadata => metadata.onBind(bind, unbind, isBound, rebind)));
    });

    const moduleConstructor: ModuleConstructor = (class implements ModuleClass {

        async onCreate(container: Container) {
            return container.loadAsync(containerModule);
        }

        async onDestroy(container: Container) {
            return container.unload(containerModule);
        }
    });

    setModuleMetadata(moduleConstructor, {
        requires: spec.requires || [],
        components: spec.components || [],
        moduleLifecycleFactory: (container:Container) => {
            return new ModuleLifecycle(container);
        }
    });
    return moduleConstructor;
}


