import {decorate, injectable, interfaces} from 'inversify';
import {Abstract, Constructor, ComponentMetadata, ServiceIdentifier} from './interfaces';

const ComponentMetadataSymbol = Symbol('ComponentSpec');

export enum ComponentScope {
    SINGLETON,
    REQUEST,
    TRANSIENT
}

export interface ComponentOption {
    scope?: ComponentScope;
    id?: string | symbol | Abstract<any>;
    name?: string;
}


export function getComponentMetadata<T>(target: Constructor<T>| Abstract<T>): ComponentMetadata<T> {
    const result: ComponentMetadata<T> = Reflect.getMetadata(ComponentMetadataSymbol, target);
    if (!result) {
        throw new Error('Target is not an component');
    }
    return result;
}

/**
 * Component decorator
 * @param spec
 * @decorator
 */
export function Component(spec: ComponentOption = {}) {
    return function <T>(target: Constructor<T>) {
        decorate(injectable(), target);
        if (typeof spec.id === 'function') {
            if (!(target.prototype instanceof spec.id) && spec.id !== target) {
                throw new Error('Explicitly specified component id must be string, symbol, or any of its base class');
            }
        }
        const id: ServiceIdentifier<T> = spec.id || target;
        const metadata: ComponentMetadata<T> = {
            onBind: async (bind) => {
                let bindOperation = bind(id).to(target);
                switch (spec.scope) {
                case ComponentScope.REQUEST:
                    bindOperation.inRequestScope();
                    break;
                case ComponentScope.SINGLETON:
                    bindOperation.inSingletonScope();
                    break;
                case ComponentScope.TRANSIENT:
                default:
                    bindOperation.inTransientScope();
                    break;
                }
            }
        };
        Reflect.defineMetadata(ComponentMetadataSymbol, metadata, target);
    };
}

interface ComponentFactorySpec {
    provide: Constructor<unknown> | Abstract<unknown>;
    scope?: ComponentScope;
}

export type ComponentFactoryContext = interfaces.Context;




@injectable()
export abstract class ComponentFactory<T> {

    abstract build(context: interfaces.Context): T;
}


Component.Factory = function (spec: ComponentFactorySpec) {
    return function <T>(target: Constructor<ComponentFactory<T>>) {
        decorate(injectable(), target);
        const id: ServiceIdentifier<ComponentFactory<T>> = target;
        const metadata: ComponentMetadata<T> = {
            onBind: async (bind) => {
                const bindFactoryOperation = bind(id).to(target);

                switch (spec.scope) {
                case ComponentScope.REQUEST:
                    bindFactoryOperation.inRequestScope();
                    break;
                case ComponentScope.SINGLETON:
                    bindFactoryOperation.inSingletonScope();
                    break;
                case ComponentScope.TRANSIENT:
                default:
                    bindFactoryOperation.inTransientScope();
                    break;
                }
                const bindTargetOperation = bind(spec.provide).toDynamicValue((context): T => {
                    return context.container
                        .get<ComponentFactory<T>>(id)
                        .build(context);
                });
                bindTargetOperation.inTransientScope();
                // switch (spec.scope) {
                // case ComponentScope.REQUEST:
                //     bindTargetOperation.inRequestScope();
                //     break;
                // case ComponentScope.SINGLETON:
                //     bindTargetOperation.inSingletonScope();
                //     break;
                // case ComponentScope.TRANSIENT:
                // default:
                //     bindTargetOperation.inTransientScope();
                //     break;
                // }
            }
        };
        Reflect.defineMetadata(ComponentMetadataSymbol, metadata, target);
    };

};
