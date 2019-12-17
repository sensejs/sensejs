import {ConstructorDecorator, DecoratorDiscriminator} from './decorator-discriminator';
import {Constructor} from '../interfaces';

function getName(func: Function | string | symbol) {
  return typeof func === 'function' ? func.name : typeof func === 'symbol' ? func.toString() : func;
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
  const deprecateMessageEmitter = makeDeprecateMessageEmitter(target, replacedBy);
  const proxyFunction = (...args: unknown[]) => {
    deprecateMessageEmitter();
    return target(...args);
  };
  return new Proxy(proxyFunction, {
    get: (target: Function, handler: string | symbol | number): any => {
      if (handler === 'length') {
        return target.length;
      }
      return Reflect.get(target, handler);
    },
  }) as T;
}

interface DeprecatedDecorator extends ConstructorDecorator, MethodDecorator {

}

function makeDeprecateConstructorProxy(replacedBy?: Function | string | symbol) {
  return <T extends {}>(target: Constructor<T>) => {
    const constructorDescriptor = Object.getOwnPropertyDescriptor(target.prototype, 'constructor');
    if (!constructorDescriptor) {
      return;
    }
    const deprecateMessageEmitter = makeDeprecateMessageEmitter(target, replacedBy);
    return new Proxy(target, {
      construct: (constructor: Constructor<T>, args: unknown[]): T => {
        deprecateMessageEmitter();
        return Reflect.construct(constructor, args);
      }
    });
  };
}

function makeDeprecatedMethodProxy(replacedBy?: Function | string | symbol) {
  return <T extends Function>(target: {} | Function, name: string | symbol, pd: TypedPropertyDescriptor<T>) => {
    const origin = pd.value;
    if (!origin) {
      throw new Error('Deprecated target is not a function');
    }
    return deprecate<T>(origin, replacedBy);
  };
}

export function Deprecated(option: {replacedBy?: Function | string} = {}) {
  return new DecoratorDiscriminator('Deprecated', false)
    .whenApplyToInstanceMethod(makeDeprecatedMethodProxy(option.replacedBy))
    .whenApplyToStaticMethod(makeDeprecatedMethodProxy(option.replacedBy))
    .whenApplyToConstructor(makeDeprecateConstructorProxy(option.replacedBy))
    .as<DeprecatedDecorator>();
}
