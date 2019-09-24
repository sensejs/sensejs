import {Abstract, Constructor} from './interfaces';
import {AsyncContainerModule, Container, decorate, injectable} from 'inversify';
import {getComponentMetadata} from './component';


export interface ModuleOption {
    /**
     * Dependencies of this module, must be decorated
     */
    requires?: Constructor<unknown>[],

    /**
     * Components provided by this module
     */
    components?: (Constructor<unknown>|Abstract<unknown>)[]
}

export interface ModuleMetadata {
    requires: Constructor<unknown>[];
    components: (Constructor<unknown>|Abstract<unknown>)[];
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
    async onCreate(componentList: (Constructor<unknown>|Abstract<unknown>)[]) {
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

export function getModuleMetadata<T>(target: Constructor<T>): ModuleMetadata {
    const result = Reflect.get(target, MODULE_REFLECT_SYMBOL);
    if (!result) {
        throw new Error('target is not decorated with @Module annotation');
    }
    return result;
}

export function setModuleMetadata(module: Constructor<unknown>, metadata: ModuleMetadata) {
    decorate(injectable(), module);
    for (const module of metadata.requires) {
        if (!Reflect.get(module, MODULE_REFLECT_SYMBOL)) {
            throw new Error('This module are requiring an invalid module');
        }
    }

    for (const component of metadata.components) {
        if (typeof component === 'function') {
            // Check whether component
            getComponentMetadata(component);
        }
    }
    Reflect.set(module, MODULE_REFLECT_SYMBOL, metadata);

}

/**
 *
 * @decorator
 */

export function Module(spec: ModuleOption = {}) {

    return function <T>(target: Constructor<T>) {
        setModuleMetadata(target, {
            requires: spec.requires || [],
            components: spec.components || [],
            moduleLifecycleFactory: container => {
                return new ModuleLifecycle(container);
            }
        });
    };
}


