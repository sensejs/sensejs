import {Constructor, ServiceIdentifier} from './interfaces';
import {Container, decorate, inject, injectable} from 'inversify';

export interface Transformer<Input = any, Output = Input> {
  (input: Input): Output;
}

export interface ParamBindingOption {
  transform?: Transformer;
}

interface ParamBindingMetadata {
  target: ServiceIdentifier<unknown>;
  transform: Transformer;
}

interface FunctionParamBindingMetadata {
  paramsMetadata: ParamBindingMetadata[];
  invoker: Constructor<Invokable>;
}

export class ParamBindingError extends Error {}

interface Invokable {
  call(paramsBindingMetadata: ParamBindingMetadata[], self: any): any;
}

const ParamBindingKey = Symbol('ParamBindingKey');

export function ensureParamBindingMetadata(target: any): FunctionParamBindingMetadata {
  if (typeof target !== 'function') {
    throw new TypeError('@ParamBinding target is not a function');
  }
  let result = Reflect.get(target, ParamBindingKey);
  if (typeof result !== 'undefined') {
    return result;
  }

  @injectable()
  class Invoker implements Invokable {
    private readonly args: unknown[];

    constructor(...args: unknown[]) {
      this.args = args;
    }

    call(paramsBindingMetadata: ParamBindingMetadata[], self: any) {
      return target.apply(self, this.args.map((elem, idx) => paramsBindingMetadata[idx].transform(elem)));
    }
  }

  result = {
    paramsMetadata: [],
    invoker: Invoker,
  };

  Reflect.set(target, ParamBindingKey, result);
  return result;
}

export function ParamBinding(target: ServiceIdentifier<unknown>, option: ParamBindingOption = {}) {
  return <T, M extends keyof T>(prototype: T, methodName: M, paramIndex: number) => {
    const metadata = ensureParamBindingMetadata(prototype[methodName]);
    if (metadata.paramsMetadata[paramIndex]) {
      throw new ParamBindingError();
    }
    // XXX: Why return value of inject() cannot be converted to ParameterDecorator?
    const parameterDecorator = inject(target) as ParameterDecorator;
    decorate(parameterDecorator, metadata.invoker as Constructor<unknown>, paramIndex);

    metadata.paramsMetadata[paramIndex] = Object.assign(
      {target},
      {transform: option.transform ? option.transform : (x: unknown) => x},
    );
  };
}

export function getFunctionParamBindingMetadata(method: Function): FunctionParamBindingMetadata {
  return Reflect.get(method, ParamBindingKey);
}

export class ParamBindingResolvingError extends Error {}

function resolveInvoker(container: Container, invokerConstructor: Constructor<Invokable>) {
  try {
    return container.resolve<Invokable>(invokerConstructor);
  } catch (e) {
    throw new ParamBindingResolvingError();
  }
}

export function invokeMethod<T>(container: Container, target: T, method: (this: T, ...args: any[]) => unknown) {
  const metadata = getFunctionParamBindingMetadata(method);
  if (!metadata) {
    throw new ParamBindingResolvingError();
  }

  if (metadata.paramsMetadata.length !== method.length) {
    throw new ParamBindingResolvingError();
  }
  const invoker = resolveInvoker(container, metadata.invoker);

  return invoker.call(metadata.paramsMetadata, target);
}
