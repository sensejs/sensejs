import {
    Component,
    Constructor,
    ensureParamBindingMetadata,
    getFunctionParamBindingMetadata,
    ParamBinding,
    ParamBindingTransformer
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

export interface ControllerMetadata {
    path: string;
    target: Constructor<unknown>
    prototype: object;
    interceptors: Constructor<unknown>[]
}

export interface ControllerMappingOption {
    interceptors?: Constructor<unknown>[]
}

const noop: ParamBindingTransformer = (x) => x;

export function Path(name: string, transform: ParamBindingTransformer = noop) {
    return ParamBinding(HttpParamBindingSymbolForPath, {
        transform: (pathParam: HttpRequestBuiltinParam) => transform(pathParam[name])
    });
}

export function Body(transform: ParamBindingTransformer = noop) {
    return ParamBinding(HttpParamBindingSymbolForBody, {
        transform
    });
}

export function Query(transform: ParamBindingTransformer = noop) {
    return ParamBinding(HttpParamBindingSymbolForQuery, {
        transform
    });
}

export function Header(name: string, transform: ParamBindingTransformer = noop) {
    name = name.toLowerCase();
    return ParamBinding(HttpParamBindingSymbolForHeader, {
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

export const HttpParamBindingSymbolForHeader = Symbol('HttpParamBindingSymbolForHeader');
export const HttpParamBindingSymbolForQuery = Symbol('HttpParamBindingSymbolForQuery');
export const HttpParamBindingSymbolForBody = Symbol('HttpParamBindingSymbolForQuery');
export const HttpParamBindingSymbolForPath = Symbol('HttpParamBindingSymbolForQuery');


export const RequestMappingMetadataKey = Symbol('ReqeustMappingMetadataKey');

function setRequestMappingMetadata(targetMethod: object, requestMappingMetadata: RequestMapping) {
    if (Reflect.get(targetMethod, RequestMappingMetadataKey)) {
        throw new Error('target method is already decorated with RequestMapping');
    }
    Reflect.set(targetMethod, RequestMappingMetadataKey, requestMappingMetadata);
}

export function getRequestMappingMetadata(targetMethod: object): RequestMapping | undefined{
    return Reflect.get(targetMethod, RequestMappingMetadataKey);
}

export function RequestMapping(httpMethod: HttpMethod, path: string) {
    return function <T extends Object>(prototype: T, method: (keyof T & string)) {
        const targetMethod = prototype[method];
        if (typeof targetMethod !== 'function') {
            throw new Error('Request mapping decorator must be applied to a function');
        }
        // const requestMapping = ensureRequestMapping(prototype, method);
        setRequestMappingMetadata(targetMethod, {
            httpMethod,
            path,
            interceptors: [] //TODO: Support request maaping interceptor
        });
        ensureParamBindingMetadata(prototype, targetMethod);
        const paramBindingMapping = getFunctionParamBindingMetadata(prototype[method]);
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

export function setHttpControllerMetadata(target: Constructor<unknown>, controllerMetadata: ControllerMetadata) {
    if (Reflect.get(target, ControllerMetadataKey)) {
        throw new Error('Target constructor is already has controller metadata');
    }
    Reflect.set(target, ControllerMetadataKey, controllerMetadata);
}

export function getHttpControllerMetadata(target: Constructor<unknown>): ControllerMetadata | undefined {
    return Reflect.get(target, ControllerMetadataKey);
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
