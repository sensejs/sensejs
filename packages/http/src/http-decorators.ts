import {
    Component,
    Constructor,
    ensureParamBindingMetadata,
    getFunctionParamBindingMetadata,
    ParamBinding,
    Transformer
} from "@sensejs/core";

export enum HttpMethod {
    GET = 'get',
    POST = 'post',
    PUT = 'put',
    DELETE = 'delete',
    PATCH = 'patch',
}

export interface RequestMapping {
    interceptors: Constructor<unknown>[]
    httpMethod: HttpMethod;
    path: string;
}

export interface RequestMappingOption {
    interceptors?: Constructor<unknown>[]
}

export interface ControllerMetadata {
    path: string;
    target: Constructor<unknown>
    prototype: object;
    interceptors: Constructor<unknown>[]
}

export interface ControllerMappingOption {
    interceptors?: Constructor<unknown>[]
}

const noop: Transformer = (x) => x;

export function Path(name: string, transform: Transformer = noop) {
    return ParamBinding(BindingSymbolForPath, {
        transform: (pathParam: { [name: string]: string }) => transform(pathParam[name])
    });
}

export function Body(transform: Transformer = noop) {
    return ParamBinding(BindingSymbolForBody, {
        transform
    });
}

export function Query(transform: Transformer = noop) {
    return ParamBinding(BindingSymbolForQuery, {
        transform
    });
}

export function Header(name: string, transform: Transformer = noop) {
    name = name.toLowerCase();
    return ParamBinding(BindingSymbolForHeader, {
        transform: (headerSet) => headerSet[name]
    });
}

export interface HttpRequestBuiltinParam {
    body: unknown;
    query: unknown;
    path: {
        [key: string]: string
    },
    header: {
        [key: string]: string
    }
}

export const BindingSymbolForHeader = Symbol('HttpParamBindingSymbolForHeader');
export const BindingSymbolForQuery = Symbol('HttpParamBindingSymbolForQuery');
export const BindingSymbolForBody = Symbol('HttpParamBindingSymbolForQuery');
export const BindingSymbolForPath = Symbol('HttpParamBindingSymbolForQuery');


const RequestMappingMetadataKey = Symbol('RequestMappingMetadataKey');

function setRequestMappingMetadata(targetMethod: object, requestMappingMetadata: RequestMapping) {
    if (Reflect.get(targetMethod, RequestMappingMetadataKey)) {
        throw new Error('target method is already decorated with RequestMapping');
    }
    Reflect.set(targetMethod, RequestMappingMetadataKey, requestMappingMetadata);
}

export function getRequestMappingMetadata(targetMethod: object): RequestMapping | undefined {
    return Reflect.get(targetMethod, RequestMappingMetadataKey);
}

export function RequestMapping(httpMethod: HttpMethod, path: string, option: RequestMappingOption = {}) {
    return function <T extends Object>(prototype: T, method: (keyof T & string)) {
        const targetMethod = prototype[method];
        if (typeof targetMethod !== 'function') {
            throw new Error('Request mapping decorator must be applied to a function');
        }
        // const requestMapping = ensureRequestMapping(prototype, method);
        setRequestMappingMetadata(targetMethod, {
            httpMethod,
            path,
            interceptors: option.interceptors || []
        });
        ensureParamBindingMetadata(targetMethod);
        const paramBindingMapping = getFunctionParamBindingMetadata(targetMethod);
        for (let i = 0; i < targetMethod.length; i++) {
            // TODO: Further check
            if (!paramBindingMapping.paramsMetadata[i]) {
                throw new Error(`Parameter at position ${i} is not decorated`);
            }
        }
    };
}

export function GET(path: string) {
    return RequestMapping(HttpMethod.GET, path);
}

export function POST(path: string) {
    return RequestMapping(HttpMethod.POST, path);
}

export function PATCH(path: string) {
    return RequestMapping(HttpMethod.PATCH, path);
}

export function DELETE(path: string) {
    return RequestMapping(HttpMethod.DELETE, path);
}

export function PUT(path: string) {
    return RequestMapping(HttpMethod.PUT, path);
}


const ControllerMetadataKey = Symbol('ControllerMetadataKey');

function setHttpControllerMetadata(target: Constructor<unknown>, controllerMetadata: ControllerMetadata) {
    if (Reflect.getMetadata(ControllerMetadataKey, target)) {
        throw new Error('Target constructor is already has controller metadata');
    }
    Reflect.defineMetadata(ControllerMetadataKey, controllerMetadata, target);
}

export function getHttpControllerMetadata(target: Object): ControllerMetadata | undefined {
    return Reflect.getMetadata(ControllerMetadataKey, target);
    // return Reflect.get(target, ControllerMetadataKey);
}

/**
 *
 * @decorator
 */
export function Controller(path: string, controllerOption: ControllerMappingOption = {}) {

    return function <T>(target: Constructor<T>) {

        // Decorate target as a component
        Component()(target);
        setHttpControllerMetadata(target, {
            target,
            path,
            prototype: target.prototype,
            interceptors: controllerOption.interceptors || []
        });
    };
}
