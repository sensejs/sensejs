import {Class, Constructor, ParamInjectionMetadata, InjectScope, ServiceId} from './types';
import {InvalidParamBindingError, NoEnoughInjectMetadataError} from './errors';

export interface MethodInvokeMetadata {
  proxy: Map<keyof any, Constructor<MethodInvokeProxy>>;
}

interface MethodInvokeProxy {
  call(method: Function, self: object): any;
}
const PARAM_INJECT_METADATA_KEY = Symbol();
const METHOD_INVOKE_METADATA = Symbol();
const SCOPE_METADATA_KEY = Symbol('SCOPE');

export interface DecoratorMetadata {
  params: Map<number, Partial<ParamInjectionMetadata>>;
}

export function getInjectScope(ctor: Class): InjectScope | undefined {
  return Reflect.getOwnMetadata(SCOPE_METADATA_KEY, ctor) as InjectScope | undefined;
}

export function setInjectScope(ctor: Class, scope: InjectScope): void {
  Reflect.defineMetadata(SCOPE_METADATA_KEY, scope, ctor);
}

export function ensureConstructorParamInjectMetadata(ctor: Class): DecoratorMetadata {
  let metadata = Reflect.getOwnMetadata(PARAM_INJECT_METADATA_KEY, ctor) as DecoratorMetadata;

  if (metadata) {
    return metadata;
  }

  metadata = {
    params: new Map(),
  };
  Reflect.defineMetadata(PARAM_INJECT_METADATA_KEY, metadata, ctor);
  return metadata;
}

export function getConstructorParamInjectMetadata(ctor: Class): DecoratorMetadata | undefined {
  return Reflect.getOwnMetadata(PARAM_INJECT_METADATA_KEY, ctor);
}

export function ensureMethodInvokeMetadata(prototype: {}): MethodInvokeMetadata {
  let metadata = Reflect.getOwnMetadata(METHOD_INVOKE_METADATA, prototype) as MethodInvokeMetadata | undefined;

  if (metadata) {
    return metadata;
  }

  const parentMetadata = Reflect.getMetadata(METHOD_INVOKE_METADATA, prototype) as MethodInvokeMetadata | undefined;
  const proxy = new Map(parentMetadata?.proxy ?? []);
  metadata = {
    proxy,
  };
  Reflect.defineMetadata(METHOD_INVOKE_METADATA, metadata, prototype);
  return metadata;
}

export function ensureMethodInvokeProxy(prototype: {}, methodKey: keyof any): Constructor<MethodInvokeProxy> {
  const metadata = ensureMethodInvokeMetadata(prototype);
  const proxy = metadata.proxy.get(methodKey);
  if (proxy) {
    return proxy;
  }

  class InvokeProxy implements MethodInvokeProxy {
    args: any[];

    constructor(...args: any[]) {
      this.args = args;
    }

    call(fn: Function, self: object): any {
      return fn.apply(self, this.args);
    }
  }

  metadata.proxy.set(methodKey, InvokeProxy);
  return InvokeProxy;
}

export function ensureValidatedMethodInvokeProxy<T extends {}, K extends keyof T>(
  constructor: Constructor<T>,
  methodKey: K,
): [Constructor<MethodInvokeProxy>, Function] {
  const proxy = ensureMethodInvokeProxy(constructor.prototype, methodKey) as Constructor<MethodInvokeProxy>;
  const cm = convertParamInjectionMetadata(ensureConstructorParamInjectMetadata(proxy), proxy);
  const fn = constructor.prototype[methodKey];
  if (typeof fn !== 'function') {
    throw new TypeError(`${constructor.name}.${String(methodKey)} is not a function`);
  }
  if (cm.length < fn.length) {
    throw new NoEnoughInjectMetadataError(constructor, methodKey);
  }
  return [proxy, fn];
}

export function assignParamInjectMetadata(ctor: Class, index: number, metadata: Partial<ParamInjectionMetadata>): void {
  const cm = ensureConstructorParamInjectMetadata(ctor);
  let pm = cm.params.get(index);
  if (!pm) {
    pm = {optional: false};
    cm.params.set(index, pm);
  }
  Object.assign(pm, metadata);
}

export function ensureValidatedParamInjectMetadata(
  paramInjectionMetadata: ParamInjectionMetadata[],
): ParamInjectionMetadata[] {
  const sortedMetadata = Array.from(paramInjectionMetadata).sort((l, r) => l.index - r.index);
  sortedMetadata.forEach((value, index) => {
    if (value.index !== index) {
      throw new InvalidParamBindingError(sortedMetadata, index);
    }
  });
  return sortedMetadata;
}

export function convertParamInjectionMetadata(
  cm: DecoratorMetadata,
  constructor: Constructor,
): ParamInjectionMetadata[] {
  const result: ParamInjectionMetadata[] = Array(constructor.length);
  const designedParamType: ServiceId[] = Reflect.getOwnMetadata('design:paramtypes', constructor);
  const fallbackToDesignType = (index: number): ServiceId => {
    const designedType = designedParamType[index];
    if (typeof designedType !== 'function' || !getConstructorParamInjectMetadata(designedType)) {
      throw new TypeError('param inject id is undefined');
    }
    return designedType;
  };
  cm.params.forEach((value, index) => {
    const {transform, optional = false} = value;
    let id = value.id;
    if (typeof id === 'undefined') {
      id = fallbackToDesignType(index);
    }
    result[index] = {index, id, transform, optional};
  });
  for (let index = 0; index < result.length; index++) {
    if (typeof result[index] === 'undefined') {
      result[index] = {id: fallbackToDesignType(index), index, optional: false};
    }
  }
  return result;
}
