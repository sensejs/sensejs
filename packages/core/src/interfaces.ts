import {interfaces} from 'inversify';

export interface Constructor<T> {
    new (...args: any[]): T
}

export interface Abstract<T> extends Function {
    prototype: T
}

export type ServiceIdentifier<T> = interfaces.ServiceIdentifier<T>;


/**
 * Component metadata
 *
 * Specify how to register an component into IoC Container, as well as its scope
 */
export interface ComponentMetadata<T> {
    onBind(bind: interfaces.Bind,
           unbind: interfaces.Unbind,
           isBound: interfaces.IsBound,
           rebind: interfaces.Rebind): Promise<void>;
}
