import {Injectable, Scope, InjectScope, ServiceId, ClassServiceId} from '@sensejs/container';
import {Class, ComponentMetadata, Constructor} from './interfaces.js';
import {InvalidComponentError, InvalidComponentIdError} from './error.js';
export {InjectScope as ComponentScope, Scope} from '@sensejs/container';

const COMPONENT_METADATA_KEY = Symbol('ComponentSpec');

export interface ComponentOption<T extends {} = {}> {
  id?: ClassServiceId<T>;
}

export function getComponentMetadata<T extends {}>(target: Class<T>): ComponentMetadata<T> {
  const result: ComponentMetadata<T> = Reflect.getMetadata(COMPONENT_METADATA_KEY, target);
  if (!result) {
    throw new InvalidComponentError(target);
  }
  return result;
}

export function setComponentMetadata<T extends {}>(target: Constructor<T>, option: ComponentOption<T>): void {
  if (Reflect.hasOwnMetadata(COMPONENT_METADATA_KEY, target)) {
    throw new Error(`Decorator @${Component.name} cannot applied multiple times to "${target.name}`);
  }
  const {id = target} = option;
  const metadata: ComponentMetadata<T> = {
    target,
    id,
  };

  Reflect.defineMetadata(COMPONENT_METADATA_KEY, metadata, target);
}

/**
 * Component decorator
 * @param option
 * @decorator
 */
export function Component(option: ComponentOption = {}) {
  return (target: Constructor): void => {
    Injectable()(target);
    if (typeof option.id === 'function') {
      if (!(target.prototype instanceof option.id) && option.id !== target) {
        throw new InvalidComponentIdError(target, option.id);
      }
    }
    setComponentMetadata(target, option);
  };
}
