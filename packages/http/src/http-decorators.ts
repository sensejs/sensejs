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

export interface ParamMapping {
    index: number,
}


export interface RequestMapping {
    interceptors: Constructor<unknown>[]
    paramMapping: ParamMapping[]
    method?: string;
    path?: string;
}

export interface ControllerMetadata {
    path?: string;
    target?: Constructor<unknown>
    interceptors: Constructor<unknown>[]
    methods: {
        [method: string]: RequestMapping
    }
}

export interface ControllerMappingOption {
    interceptors?: Constructor<unknown>[]
}

function ensureControllerMetadata(prototype): ControllerMetadata {

    let metadata: ControllerMetadata = Reflect.get(prototype, RequestMappingKey);
    if (!metadata) {
        metadata = {
            interceptors: [],
            methods: {}
        };
        Reflect.set(prototype, RequestMappingKey, metadata);
    }
    return metadata;
}

export function getHttpControllerMetadata(target: Constructor<unknown>): ControllerMetadata {
    return Reflect.get(target.prototype, RequestMappingKey);
}

function ensureRequestMapping(prototype, method): RequestMapping {
    const controllerMapping = ensureControllerMetadata(prototype);
    let requestMapping = controllerMapping.methods[method];
    if (requestMapping) {
        return requestMapping;
    }

    controllerMapping.methods[method] = requestMapping = {
        interceptors: [],
        paramMapping: []
    };
    return requestMapping;
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


const RequestMappingKey = Symbol('RequestMappingKey');

export function RequestMapping(httpMethod: HttpMethod, path: string) {
    return function <T extends Object>(prototype: T, method: (keyof T & string)) {
        const targetMethod = prototype[method];
        if (typeof targetMethod !== 'function') {
            throw new Error('Request mapping decorator must be applied to a function');
        }
        ensureParamBindingMetadata(prototype, targetMethod);
        const requestMapping = ensureRequestMapping(prototype, method);
        const paramBindingMapping = getFunctionParamBindingMetadata(prototype[method]);
        if (requestMapping.method || requestMapping.path) {
            throw new Error('Request mapping decorator already applied');
        }

        for (let i = 0; i < targetMethod.length; i++) {
            // TODO: Further check
            if (!paramBindingMapping.paramsMetadata[i]) {
                throw new Error(`Parameter at position ${i} is not decorated`);
            }
        }

        requestMapping.method = httpMethod;
        requestMapping.path = path;
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


/**
 *
 * @decorator
 */
export function Controller(path: string, controllerOption?: ControllerMappingOption) {

    return function <T>(target: Constructor<T>) {

        // Decorate target as a component
        Component()(target);

        // TODO: Specify Http Controller Metadata
        const controllerMapping = ensureControllerMetadata(target.prototype);
        controllerMapping.target = target;
        controllerMapping.path = path;
        if (controllerOption) {
            if (controllerOption.interceptors) {
                controllerMapping.interceptors = controllerMapping.interceptors.concat(controllerOption.interceptors);
            }
        }
    };
}
