import {Class, Constructor, InjectScope, ServiceId, Transformer} from './types';
import {
  assignParamInjectMetadata,
  ensureConstructorParamInjectMetadata,
  ensureMethodInvokeProxy,
  getInjectScope,
  setInjectScope,
} from './metadata';

export function inject<T, R = T>(serviceId: ServiceId<T>, transformer?: Transformer<T, R>) {
  return (ctor: Class | {}, name: keyof any, index: number): void => {
    if (typeof ctor !== 'function') {
      const x = ensureMethodInvokeProxy(ctor, name);
      assignParamInjectMetadata(x, index, {id: serviceId, transform: transformer});
    } else {
      assignParamInjectMetadata(ctor, index, {id: serviceId, transform: transformer});
    }
  };
}

export function optional(value = true) {
  return (ctor: Class | {}, name: keyof any, index: number): void => {
    if (typeof ctor !== 'function') {
      const x = ensureMethodInvokeProxy(ctor, name);
      assignParamInjectMetadata(x, index, {optional: value});
    } else {
      assignParamInjectMetadata(ctor, index, {optional: value});
    }
  };
}

/**
 * @deprecated
 */
export interface InjectableOption {
  scope?: InjectScope;
}

export function injectable(): (ctor: Class) => void;
/**
 * @deprecated
 */
export function injectable(option: InjectableOption): (ctor: Class) => void;

export function injectable(option: InjectableOption = {}) {
  return (ctor: Class): void => {
    ensureConstructorParamInjectMetadata(ctor);

    if (typeof option.scope !== 'undefined' && !getInjectScope(ctor)) {
      setInjectScope(ctor, option.scope);
    }
  };
}

export function scope(scope: InjectScope) {
  return (ctor: Constructor): void => {
    setInjectScope(ctor, scope);
  };
}
