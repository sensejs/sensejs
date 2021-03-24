import {Class, ConstructorParamDecorator, DecoratorBuilder} from '@sensejs/utility';
import {ParamInjectionMetadata, Scope, ServiceId} from './types';

const PARAM_INJECT_METADATA_KEY = Symbol();

export interface ConstructorParamInjectMetadata {
  params: Map<number, Partial<ParamInjectionMetadata<any>>>;
  scope: Scope;
}

export function ensureConstructorParamInjectMetadata(ctor: Class): ConstructorParamInjectMetadata {
  let metadata = Reflect.getMetadata(PARAM_INJECT_METADATA_KEY, ctor.prototype) as ConstructorParamInjectMetadata;

  if (metadata) {
    return metadata;
  }

  metadata = {
    params: new Map(),
    scope: Scope.TRANSIENT,
  };
  Reflect.defineMetadata(PARAM_INJECT_METADATA_KEY, metadata, ctor.prototype);
  return metadata;
}

function assignParamInjectMetadata(ctor: Class, index: number, metadata: Partial<ParamInjectionMetadata<any>>) {
  const cm = ensureConstructorParamInjectMetadata(ctor);
  let pm = cm.params.get(index);
  if (!pm) {
    pm = {optional: false};
    cm.params.set(index, pm);
  }
  Object.assign(pm, metadata);
}

export function inject<T>(serviceId: ServiceId<T>, transformer?: (x: T) => any): ConstructorParamDecorator {
  return new DecoratorBuilder(inject.name)
    .whenApplyToConstructorParam((ctor, index) => {
      assignParamInjectMetadata(ctor, index, {id: serviceId, transform: transformer});
    })
    .build<ConstructorParamDecorator>();
}

export function optional(): ConstructorParamDecorator {
  return new DecoratorBuilder(optional.name)
    .whenApplyToConstructorParam((ctor, index) => {
      assignParamInjectMetadata(ctor, index, {optional: true});
    })
    .build<ConstructorParamDecorator>();
}

export interface InjectableOption {
  scope?: Scope;
}

export function injectable(option: InjectableOption = {}): ClassDecorator {
  return new DecoratorBuilder(injectable.name)
    .whenApplyToConstructor((ctor) => {
      const m = ensureConstructorParamInjectMetadata(ctor);
      if (typeof option.scope !== 'undefined') {
        m.scope = option.scope;
      }
    })
    .build<ClassDecorator>();
}
