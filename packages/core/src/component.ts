import {decorate, injectable} from 'inversify';
import {Abstract, ComponentMetadata, ComponentScope, Constructor, ServiceIdentifier} from './interfaces';

const COMPONENT_METADATA_KEY = Symbol('ComponentSpec');

export interface ComponentOption {
  scope?: ComponentScope;
  id?: string | symbol | Abstract<any>;
}

export function getComponentMetadata(target: Constructor<unknown> | Abstract<unknown>): ComponentMetadata<unknown> {
  const result: ComponentMetadata<unknown> = Reflect.getMetadata(COMPONENT_METADATA_KEY, target);
  if (!result) {
    throw new Error('Target is not an component');
  }
  return result;
}

function ensureComponentMetadata(target: Constructor<unknown>) {
  let result: ComponentMetadata<unknown> = Reflect.getMetadata(COMPONENT_METADATA_KEY, target);
  if (!result) {
    result = {
      target,
      scope: ComponentScope.TRANSIENT,
    };
    Reflect.defineMetadata(COMPONENT_METADATA_KEY, result, target);
  }
  return result;
}

export function Tagged(key: string | number | symbol, value: unknown) {
  return (target: Constructor<unknown>) => {
    const metadata = ensureComponentMetadata(target);
    metadata.tags = metadata.tags ?? [];
    metadata.tags.push({key, value});
  };
}

export function Named(name: string) {
  return (target: Constructor<unknown>) => {
    const metadata = ensureComponentMetadata(target);
    metadata.name = name;
  };
}

/**
 * Component decorator
 * @param spec
 * @decorator
 */
export function Component(spec: ComponentOption = {}) {
  return (target: Constructor<unknown>) => {
    decorate(injectable(), target);
    if (typeof spec.id === 'function') {
      if (!(target.prototype instanceof spec.id) && spec.id !== target) {
        throw new Error('Explicitly specified component id must be string, symbol, or any of its base class');
      }
    }
    const id: ServiceIdentifier<unknown> = spec.id || target;
    const metadata = ensureComponentMetadata(target);
    if (spec.id) {
      metadata.id = spec.id;
    }
    metadata.id = id;
    if (spec.scope) {
      metadata.scope = spec.scope;
    }
  };
}
