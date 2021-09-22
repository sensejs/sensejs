import {Injectable, Scope, InjectScope} from '@sensejs/container';
import {Class, ComponentMetadata, Constructor} from './interfaces.js';
export {InjectScope as ComponentScope, Scope} from '@sensejs/container';

const COMPONENT_METADATA_KEY = Symbol('ComponentSpec');

export interface ComponentOption<T extends {} = {}> {
  /** @deprecated */
  scope?: InjectScope;
  id?: string | symbol | Class<T>;
  /** @deprecated Use of this option is not recommended, decorate base with `@Injectable()` instead */
  bindParentConstructor?: boolean;
}

export function getComponentMetadata<T extends {}>(target: Class<T>): ComponentMetadata<T> {
  const result: ComponentMetadata<T> = Reflect.getMetadata(COMPONENT_METADATA_KEY, target);
  if (!result) {
    throw new Error('Target is not an component');
  }
  return result;
}

export function setComponentMetadata<T extends {}>(target: Constructor<T>, option: ComponentOption<T>): void {
  if (Reflect.hasOwnMetadata(COMPONENT_METADATA_KEY, target)) {
    throw new Error(`Decorator @${Component.name} cannot applied multiple times to "${target.name}`);
  }
  const {id = target, scope = Scope.TRANSIENT, bindParentConstructor = false} = option;
  const metadata: ComponentMetadata<T> = {
    target,
    id,
    scope,
    bindParentConstructor,
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
    const {scope} = option;
    if (scope) {
      Scope(scope)(target);
    }
    Injectable()(target);
    if (typeof option.id === 'function') {
      if (!(target.prototype instanceof option.id) && option.id !== target) {
        throw new Error('Explicitly specified component id must be string, symbol, or any of its base class');
      }
    }
    setComponentMetadata(target, option);
  };
}
