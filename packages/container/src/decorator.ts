import {Class, ParamInjectionMetadata, Scope, ServiceId, Transformer} from './types';
import {assignParamInjectMetadata, ensureConstructorParamInjectMetadata, ensureMethodInvokeProxy} from './metadata';

export interface DecoratorMetadata {
  params: Map<number, Partial<ParamInjectionMetadata>>;
  scope: Scope;
}

export function inject<T, R = T>(serviceId: ServiceId<T>, transformer?: Transformer<T, R>) {
  return (ctor: Class | {}, name: any, index: number): void => {
    if (typeof ctor !== 'function') {
      const x = ensureMethodInvokeProxy(ctor, name);
      assignParamInjectMetadata(x, index, {id: serviceId, transform: transformer});
    } else {
      assignParamInjectMetadata(ctor, index, {id: serviceId, transform: transformer});
    }
  };
}

export function optional(value = true) {
  return (ctor: Class | {}, name: any, index: number): void => {
    if (typeof ctor !== 'function') {
      const x = ensureMethodInvokeProxy(ctor, name);
      assignParamInjectMetadata(x, index, {optional: value});
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
