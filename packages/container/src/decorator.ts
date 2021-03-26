import {ParamInjectionMetadata, Scope, ServiceId, Transformer, Class} from './types';

const PARAM_INJECT_METADATA_KEY = Symbol();

export interface ConstructorParamInjectMetadata {
  params: Map<number, Partial<ParamInjectionMetadata>>;
  scope: Scope;
}

export function ensureConstructorParamInjectMetadata(ctor: Class): ConstructorParamInjectMetadata {
  let metadata = Reflect.getOwnMetadata(PARAM_INJECT_METADATA_KEY, ctor) as ConstructorParamInjectMetadata;

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
  return (ctor: Class, name: unknown, index: number): void => {
    assignParamInjectMetadata(ctor, index, {id: serviceId, transform: transformer});
  };
}

export function optional() {
  return (ctor: Class, name: unknown, index: number): void => {
    assignParamInjectMetadata(ctor, index, {optional: true});
  };
}

export interface InjectableOption {
  scope?: Scope;
}

export function injectable(option: InjectableOption = {}): ClassDecorator {
  return (ctor: Class) => {
    const m = ensureConstructorParamInjectMetadata(ctor);
    if (typeof option.scope !== 'undefined') {
      m.scope = option.scope;
    }
  };
}
