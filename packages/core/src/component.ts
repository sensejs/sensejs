import {decorate, injectable} from 'inversify';
import {Abstract, ComponentMetadata, ComponentScope, Constructor, ServiceIdentifier} from './interfaces';

const COMPONENT_METADATA_KEY = Symbol('ComponentSpec');

export interface ComponentOption {
  scope?: ComponentScope;
  id?: string | symbol | Abstract<any>;
  name?: string;
}

export function getComponentMetadata<T>(target: Constructor<T> | Abstract<T>): ComponentMetadata<T> {
  const result: ComponentMetadata<T> = Reflect.getMetadata(COMPONENT_METADATA_KEY, target);
  if (!result) {
    throw new Error('Target is not an component');
  }
  return result;
}

/**
 * Component decorator
 * @param spec
 * @decorator
 */
export function Component(spec: ComponentOption = {}) {
  return <T>(target: Constructor<T>) => {
    decorate(injectable(), target);
    if (typeof spec.id === 'function') {
      if (!(target.prototype instanceof spec.id) && spec.id !== target) {
        throw new Error('Explicitly specified component id must be string, symbol, or any of its base class');
      }
    }
    const id: ServiceIdentifier<T> = spec.id || target;
    const metadata: ComponentMetadata<T> = {
      onBind: async (bind) => {
        const bindOperation = bind(id).to(target);
        switch (spec.scope) {
          case ComponentScope.REQUEST:
            bindOperation.inRequestScope();
            break;
          case ComponentScope.SINGLETON:
            bindOperation.inSingletonScope();
            break;
          case ComponentScope.TRANSIENT:
          default:
            bindOperation.inTransientScope();
            break;
        }
      },
    };
    Reflect.defineMetadata(COMPONENT_METADATA_KEY, metadata, target);
  };
}
