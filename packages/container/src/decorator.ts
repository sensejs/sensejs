import {ParamInjectionMetadata, Scope, ServiceId, Transformer, Class, Constructor} from './types';

const PARAM_INJECT_METADATA_KEY = Symbol();
const METHOD_INVOKE_METADATA = Symbol();

export interface MethodInvokeMetadata {
  proxy: Map<keyof any, Constructor<MethodInvokeProxy>>;
}

interface MethodInvokeProxy {
  call(): any;
}

export interface DecoratorMetadata {
  params: Map<number, Partial<ParamInjectionMetadata>>;
  scope: Scope;
}

export function ensureConstructorParamInjectMetadata(ctor: Class): DecoratorMetadata {
  let metadata = Reflect.getOwnMetadata(PARAM_INJECT_METADATA_KEY, ctor) as DecoratorMetadata;

  if (metadata) {
    return metadata;
  }

  metadata = {
    params: new Map(),
    scope: Scope.TRANSIENT,
  };
  Reflect.defineMetadata(PARAM_INJECT_METADATA_KEY, metadata, ctor);
  return metadata;
}

export function ensureMethodInvokeMetadata(prototype: {}): MethodInvokeMetadata {
  let metadata = Reflect.getOwnMetadata(METHOD_INVOKE_METADATA, prototype) as MethodInvokeMetadata;

  if (metadata) {
    return metadata;
  }

  metadata = {
    proxy: new Map(),
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
    call(): any {
      const self = this.args[0];
      const args = this.args.slice(1);
      return self[methodKey](...args);
    }
  }
  metadata.proxy.set(methodKey, InvokeProxy);
  return InvokeProxy;
}

function assignParamInjectMetadata(ctor: Class, index: number, metadata: Partial<ParamInjectionMetadata>) {
  const cm = ensureConstructorParamInjectMetadata(ctor);
  let pm = cm.params.get(index);
  if (!pm) {
    pm = {optional: false};
    cm.params.set(index, pm);
  }
  Object.assign(pm, metadata);
}

export function inject<T, R = T>(serviceId: ServiceId<T>, transformer?: Transformer<T, R>) {
  return (ctor: Class | {}, name: any, index: number): void => {
    if (typeof ctor !== 'function') {
      const x = ensureMethodInvokeProxy(ctor, name);
      assignParamInjectMetadata(x, index + 1, {id: serviceId, transform: transformer});
    } else {
      assignParamInjectMetadata(ctor, index, {id: serviceId, transform: transformer});
    }
  };
}

export function optional(value = true) {
  return (ctor: Class | {}, name: any, index: number): void => {
    if (typeof ctor !== 'function') {
      const x = ensureMethodInvokeProxy(ctor, name);
      assignParamInjectMetadata(x, index + 1, {optional: value});
    } else {
      assignParamInjectMetadata(ctor, index, {optional: value});
    }
  };
}

export interface InjectableOption {
  scope?: Scope;
}

export function injectable(option: InjectableOption = {}) {
  return (ctor: Class): void => {
    const m = ensureConstructorParamInjectMetadata(ctor);
    if (typeof option.scope !== 'undefined') {
      m.scope = option.scope;
    }
  };
}
