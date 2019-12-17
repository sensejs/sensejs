import {ConstructorDecorator, Decorator, DecoratorBuilder} from './decorator-builder';
import {Constructor} from '../interfaces';

function getName(func: Function | string | symbol) {
  return typeof func === 'function' ? func.name : typeof func === 'symbol' ? func.toString() : func;
}

/**
 * Due to the reason that the polyfill 'reflect-metadata' does not support proxy reflect metadata,
 * or it's actually ECMA standard issue. We have to copy reflect metadata from origin to proxy
 *
 * @param result To where the metadata will be copied
 * @param target From where the metadata will be copied
 */
function copyMetadata(result: object, target: object) {
  for (const key of Reflect.getOwnMetadataKeys(target)) {
    Reflect.defineMetadata(key, Reflect.getOwnMetadata(key, target), result);
  }
}

export function makeDeprecateMessageEmitter(
  func: Function | string | symbol,
  replacedWith?: Function | string | symbol,
) {

  let emitted = false;
  let message = `"${getName(func)}" is deprecated.`;
  if (replacedWith) {
    message += `${message} Use "${getName(replacedWith)}" instead.`;
  }

  return () => {
    if (!emitted) {
      emitted = true;
      process.nextTick(() => {
        process.emitWarning(message);
      });
    }
  };
}

export function deprecate<T extends Function>(target: T, replacedBy?: Function | string | symbol): T {
  const emitter = makeDeprecateMessageEmitter(target, replacedBy);
  const result = new Proxy(target, {
    apply: (func, that, args) => {
      emitter();
      return func.apply(that, args);
    },
  }) as T;
  copyMetadata(result, target);
  return result;
}

export interface DeprecatedDecorator extends ConstructorDecorator, MethodDecorator {
}

function makeDeprecateConstructorProxy(replacedBy?: Function | string | symbol) {
  return <T extends {}>(target: Constructor<T>): Constructor<T> => {
    const emitter = makeDeprecateMessageEmitter(target, replacedBy);
    const result = new Proxy(target, {
      construct: (target: Function, argArray: unknown[], newTarget: T) => {
        emitter();
        return Reflect.construct(target, argArray, newTarget);
      },
    }) as Constructor<T>;
    copyMetadata(result, target);
    return result;
  };
}

function makeDeprecatedMethodProxy(replacedBy?: Function | string | symbol) {
  return <T extends Function>(target: {} | Function, name: string | symbol, pd: TypedPropertyDescriptor<T>) => {
    const origin = pd.value;
    if (!origin) {
      throw new Error('Deprecated target is not a function');
    }
    pd.value = deprecate<T>(origin, replacedBy);
    return pd;
  };
}

export function Deprecated(option: {replacedBy: symbol}): MethodDecorator;
export function Deprecated(option?: {replacedBy?: Function | string}): DeprecatedDecorator;

export function Deprecated(option: {replacedBy?: Function | string | symbol} = {}): Decorator {
  const dd = new DecoratorBuilder('Deprecated', false);
  dd.whenApplyToInstanceMethod(makeDeprecatedMethodProxy(option.replacedBy))
    .whenApplyToStaticMethod(makeDeprecatedMethodProxy(option.replacedBy));
  if (typeof option.replacedBy === 'symbol') {
    return dd.build();
  }
  return dd.whenApplyToConstructor(makeDeprecateConstructorProxy(option.replacedBy)).build();
}
