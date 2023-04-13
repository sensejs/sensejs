import {ClassDecorator, Decorator, DecoratorBuilder} from '@sensejs/utility';
import type {Class} from '../interfaces.js';
import {copyMetadata} from './copy-metadata.js';

function getName(func: Function | string | symbol) {
  return typeof func === 'function' ? func.name : typeof func === 'symbol' ? func.toString() : func;
}

export function makeOneTimeWarningEmitter(message: string) {
  let emitted = false;
  return () => {
    if (!emitted) {
      emitted = true;
      process.nextTick(() => {
        process.emitWarning(message);
      });
    }
  };
}

export function makeDeprecateMessageEmitter(
  func: Function | string | symbol,
  replacedWith?: Function | string | symbol,
) {
  let message = `"${getName(func)}" is deprecated.`;
  if (replacedWith) {
    message += `${message} Use "${getName(replacedWith)}" instead.`;
  }

  return makeOneTimeWarningEmitter(message);
}

export function deprecate<T extends Function>(
  target: T,
  option: DeprecateOption | DeprecateSymbolMethodOption = {},
): T {
  const emitter =
    typeof option.message === 'string'
      ? makeOneTimeWarningEmitter(option.message)
      : makeDeprecateMessageEmitter(target, option.replacedBy);

  const result = new Proxy(target, {
    apply: (func, that, args) => {
      emitter();
      return func.apply(that, args);
    },
  }) as T;
  copyMetadata(result, target);
  return result;
}

function makeDeprecateConstructorProxy(option: DeprecateOption) {
  return <T extends Class>(target: T): T => {
    const emitter =
      typeof option.message === 'string'
        ? makeOneTimeWarningEmitter(option.message)
        : makeDeprecateMessageEmitter(target, option.replacedBy);

    const result = new Proxy<T>(target, {
      construct: (target: Function, argArray: unknown[], newTarget: T) => {
        emitter();
        return Reflect.construct(target, argArray, newTarget);
      },
    });
    copyMetadata(result, target);
    return result;
  };
}

function makeDeprecatedMethodProxy(option: DeprecateOption | DeprecateSymbolMethodOption) {
  return <T extends Function, R extends Function | {}>(
    target: R,
    name: string | symbol,
    pd: TypedPropertyDescriptor<T>,
  ) => {
    const origin = pd.value;
    if (!origin) {
      throw new Error('Deprecated target is not a function');
    }
    pd.value = deprecate<T>(origin, option);
    return pd;
  };
}

interface DeprecateOption {
  replacedBy?: Function | string;
  message?: string;
}

interface DeprecateSymbolMethodOption {
  replacedBy: symbol;
  message?: string;
}

export interface DeprecatedDecorator extends ClassDecorator, MethodDecorator {}

export function Deprecated(option: DeprecateSymbolMethodOption): MethodDecorator;
export function Deprecated(option?: DeprecateOption): DeprecatedDecorator;

export function Deprecated(option: DeprecateOption | DeprecateSymbolMethodOption = {}): Decorator {
  const dd = new DecoratorBuilder('Deprecated', false);
  const methodProxy = makeDeprecatedMethodProxy(option);
  dd.whenApplyToInstanceMethod(methodProxy).whenApplyToStaticMethod(methodProxy);
  if (typeof option.replacedBy === 'symbol') {
    return dd.build();
  }
  return dd.whenApplyToConstructor(makeDeprecateConstructorProxy(option as DeprecateOption)).build();
}
