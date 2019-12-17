import {Constructor, ServiceIdentifier} from './interfaces';
import {Container, decorate, inject, injectable, named, tagged, optional} from 'inversify';
import {
  ConstructorDecorator,
  ConstructorParamDecorator,
  DecoratorBuilder,
  MethodParamDecorator, ParamDecorator,
} from './utils';
import {ensureComponentMetadata} from './component';

export interface Transformer<Input = any, Output = Input> {
  (input: Input): Output;
}

export interface MethodParameterInjectOption<T, R> {
  /**
   * Transform the injected target
   */
  transform?: Transformer<T, R>;
}

interface MethodParameterInjectMetadata {
  target: ServiceIdentifier<unknown>;
  transform: Transformer;
}

interface MethodInjectMetadata {
  paramsMetadata: MethodParameterInjectMetadata[];
  proxy: Constructor<Invokable>;
}

export class ParamBindingError extends Error {}

interface Invokable {
  call(paramsBindingMetadata: MethodParameterInjectMetadata[], self: any): any;
}

const METHOD_INJECT_KEY = Symbol('METHOD_INJECT_KEY');

function ensureMethodInjectMetadata(target: any): MethodInjectMetadata {
  if (typeof target !== 'function') {
    throw new TypeError('Decorated target for @ParamBinding is not a function');
  }
  let result = Reflect.getMetadata(METHOD_INJECT_KEY, target);
  if (typeof result !== 'undefined') {
    return result;
  }

  @injectable()
  class Proxy implements Invokable {
    private readonly args: unknown[];

    constructor(...args: unknown[]) {
      this.args = args;
    }

    call(paramsBindingMetadata: MethodParameterInjectMetadata[], self: any) {
      return target.apply(
        self,
        this.args.map((elem, idx) => paramsBindingMetadata[idx].transform(elem)),
      );
    }
  }

  result = {
    paramsMetadata: [],
    proxy: Proxy,
  } as MethodInjectMetadata;

  Reflect.defineMetadata(METHOD_INJECT_KEY, result, target);
  return result;
}

function MethodInject<T, R = T>(target: ServiceIdentifier<T>, option: MethodParameterInjectOption<T, R> = {}) {
  return (prototype: {}, methodName: string | symbol, paramIndex: number) => {
    const metadata = ensureMethodInjectMetadata(Reflect.get(prototype, methodName));
    if (metadata.paramsMetadata[paramIndex]) {
      throw new ParamBindingError();
    }
    const parameterDecorator = inject(target) as ParameterDecorator;
    decorate(parameterDecorator, metadata.proxy as Constructor<unknown>, paramIndex);

    metadata.paramsMetadata[paramIndex] = Object.assign(
      {target},
      {transform: option.transform ? option.transform : (x: unknown) => x},
    );
  };
}

/**
 * @param target Identifier of target wanted to be injected
 * @param option
 * @decorator
 * @deprecated
 * @see Inject
 */
export function ParamBinding<T, R = T>(target: ServiceIdentifier<T>, option: MethodParameterInjectOption<T, R> = {}) {
  // Defer warning to next tick to make it possible to be caught by handler set up later in this tick
  // during application start up
  process.nextTick(() => process.emitWarning('@ParamBinding() is deprecated, use @Inject() instead'));

  return MethodInject(target, option);
}

export function getFunctionParamBindingMetadata(method: Function): MethodInjectMetadata {
  process.nextTick(() => {
    process.emitWarning('getFunctionParamBindingMetadata is deprecated, use getMethodInjectMetadata instead');
  });
  return getMethodInjectMetadata(method);
}

export function getMethodInjectMetadata(method: Function): MethodInjectMetadata {
  return Reflect.getMetadata(METHOD_INJECT_KEY, method);
}

export function validateFunctionParamBindingMetadata(method: Function): MethodInjectMetadata {
  const methodInjectMetadata = ensureMethodInjectMetadata(method);
  for (let i = 0; i < method.length; i++) {
    if (!methodInjectMetadata.paramsMetadata[i]) {
      throw new Error(`Parameter at position ${i} is not decorated`);
    }
  }
  return methodInjectMetadata;
}

export class ParamBindingResolvingError extends Error {}

function resolveInvoker(container: Container, invokerConstructor: Constructor<Invokable>) {
  try {
    return container.resolve<Invokable>(invokerConstructor);
  } catch (e) {
    throw new ParamBindingResolvingError();
  }
}

export function invokeMethod<T>(container: Container, target: T, method: Function) {
  const metadata = getMethodInjectMetadata(method);
  if (!metadata) {
    throw new ParamBindingResolvingError();
  }

  if (metadata.paramsMetadata.length !== method.length) {
    throw new ParamBindingResolvingError();
  }
  const invoker = resolveInvoker(container, metadata.proxy);

  return invoker.call(metadata.paramsMetadata, target);
}

function applyToParamBindingInvoker<Parameter>(
  decorator: ParameterDecorator,
  prototype: {},
  name: string | symbol,
  index: number,
) {
  const targetMethod = Reflect.get(prototype, name);
  if (typeof targetMethod !== 'function') {
    throw new TypeError('@Optional decorator can only decorate parameter of constructor or class method');
  }
  const metadata = getMethodInjectMetadata(targetMethod);
  decorate(decorator, metadata.proxy, index);
}

export function Inject<T, R = T>(target: ServiceIdentifier<T>, option?: MethodParameterInjectOption<T, R>) {
  const name = typeof target === 'function' ? target.name : target.toString();
  const discriminator = new DecoratorBuilder(`Inject(${name})`).whenApplyToInstanceMethodParam(
    (prototype, name, index) => {
      return MethodInject(target, option)(prototype, name, index);
    },
  );
  if (typeof option === 'undefined') {
    discriminator.whenApplyToConstructorParam((constructor, index) => {
      return decorate(inject(target) as ParameterDecorator, constructor, index);
    });
  }
  return discriminator.build<ParamDecorator>();
}

export function Optional() {
  // XXX: Inversify Typing Error?
  // Need to use @optional() instead of @optional
  const decorator = optional() as ParameterDecorator;
  return new DecoratorBuilder('Optional')
    .whenApplyToInstanceMethodParam((prototype: {}, name: string | symbol, index: number) => {
      return applyToParamBindingInvoker(decorator, prototype, name, index);
    })
    .whenApplyToConstructorParam((constructor, index) => {
      return decorate(decorator, constructor, index);
    })
    .build<ParamDecorator>();
}

export interface InjectionConstraintDecorator
  extends ConstructorParamDecorator,
  MethodParamDecorator,
  ConstructorDecorator {}

export function Tagged(key: string | number | symbol, value: any) {
  const decorator = tagged(key, value) as ParameterDecorator;
  return new DecoratorBuilder(`Tagged(key=${String(key)}, value=${String(value)})`)
    .whenApplyToInstanceMethodParam((prototype: {}, name: string | symbol, index: number) => {
      return applyToParamBindingInvoker(decorator, prototype, name, index);
    })
    .whenApplyToConstructorParam((constructor, index) => {
      return decorate(decorator, constructor, index);
    })
    .whenApplyToConstructor((constructor) => {
      const metadata = ensureComponentMetadata(constructor);
      metadata.tags = metadata.tags ?? [];
      metadata.tags.push({key, value});
    })
    .build<InjectionConstraintDecorator>();
}

export function Named(name: string | symbol) {
  const decorator = named(name) as ParameterDecorator;
  return new DecoratorBuilder(`Named(name="${name.toString()}")`)
    .whenApplyToInstanceMethodParam((prototype: {}, name: string | symbol, index: number) => {
      return applyToParamBindingInvoker(decorator, prototype, name, index);
    })
    .whenApplyToConstructorParam((constructor, index) => {
      return decorate(decorator, constructor, index);
    })
    .whenApplyToConstructor((constructor) => {
      const metadata = ensureComponentMetadata(constructor);
      metadata.tags = metadata.tags ?? [];
      metadata.name = name;
    })
    .build<InjectionConstraintDecorator>();
}
