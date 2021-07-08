import {Class, Constructor, InjectScope, ServiceId, Transformer} from './types';
import {
  assignParamInjectMetadata,
  ensureConstructorParamInjectMetadata,
  ensureMethodInvokeProxy,
  getInjectScope,
  setInjectScope,
} from './metadata';

export interface InjectionDecorator {
  <T extends {}>(prototype: T, name: keyof T, index: number): void;
  <T extends Class>(ctor: Class, name: any, index: number): void;
}

export interface InjectOption<T, R> {
  /**
   * Transform the injected target
   */
  transform?: Transformer<T, R>;
}

export function Inject<T, R = T>(serviceId: ServiceId<T>, option: InjectOption<T, R> = {}): InjectionDecorator {
  return (ctor: Class | {}, name: keyof any, index: number): void => {
    if (typeof ctor !== 'function') {
      const x = ensureMethodInvokeProxy(ctor, name);
      assignParamInjectMetadata(x, index, {id: serviceId, ...option});
    } else {
      assignParamInjectMetadata(ctor, index, {id: serviceId, ...option});
    }
  };
}

/**
 * @deprecated
 */
export function inject<T, R = T>(serviceId: ServiceId<T>, transform?: Transformer<T, R>): InjectionDecorator {
  return Inject(serviceId, {transform});
}

export function Optional(value = true): InjectionDecorator {
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
export function optional(value = true): InjectionDecorator {
  return Optional(value);
}

/**
 * @deprecated
 */
export interface InjectableOption {
  scope?: InjectScope;
}

export function Injectable() {
  return (ctor: Class): void => {
    ensureConstructorParamInjectMetadata(ctor);
  };
}

/**
 * @deprecated
 */
export function injectable(option: InjectableOption = {}) {
  return (ctor: Class): void => {
    if (typeof option.scope !== 'undefined' && !getInjectScope(ctor)) {
      setInjectScope(ctor, option.scope);
    }
    return Injectable()(ctor);
  };
}

export function Scope(scope: InjectScope) {
  return (ctor: Constructor): void => {
    setInjectScope(ctor, scope);
  };
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Scope {
  export const SESSION = InjectScope.SESSION;
  export const TRANSIENT = InjectScope.TRANSIENT;
  export const SINGLETON = InjectScope.SINGLETON;
  /** @deprecated */
  export const REQUEST = InjectScope.REQUEST;
}

/**
 * @deprecated
 */
export function scope(scope: InjectScope) {
  return Scope(scope);
}
