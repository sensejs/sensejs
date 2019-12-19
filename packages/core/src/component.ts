import {decorate, injectable} from 'inversify';
import {Class, ComponentMetadata, ComponentScope, Constructor, ServiceIdentifier} from './interfaces';

const COMPONENT_METADATA_KEY = Symbol('ComponentSpec');

export interface ComponentOption {
  scope?: ComponentScope;
  id?: string | symbol | Class;
  name?: string | symbol;
  tags?: {
    key: string | number | symbol, value: unknown
  }[];
}

export function getComponentMetadata<T extends {}>(target: Class<T>): ComponentMetadata<T> {
  const result: ComponentMetadata<T> = Reflect.getMetadata(COMPONENT_METADATA_KEY, target);
  if (!result) {
    throw new Error('Target is not an component');
  }
  return result;
}

export function setComponentMetadata(target: Constructor, option: ComponentOption) {
  if (Reflect.hasOwnMetadata(COMPONENT_METADATA_KEY, target)) {
    throw new Error('Component metadata already defined for target');
  }
  const {
    tags = [],
    name,
    id = target,
    scope = ComponentScope.TRANSIENT
  } = option;

  Reflect.defineMetadata(COMPONENT_METADATA_KEY, {
    target,
    id,
    scope,
    name,
    tags
  }, target);
}

/**
 * Component decorator
 * @param option
 * @decorator
 */
export function Component(option: ComponentOption = {}) {
  return (target: Constructor) => {
    decorate(injectable(), target);
    if (typeof option.id === 'function') {
      if (!(target.prototype instanceof option.id) && option.id !== target) {
        throw new Error('Explicitly specified component id must be string, symbol, or any of its base class');
      }
    }
    setComponentMetadata(target, option);
  };
}
