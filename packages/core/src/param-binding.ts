import {Constructor, ServiceIdentifier} from './interfaces';
import {Container, decorate, inject, injectable} from 'inversify';

export interface Transformer<Input = any, Output = Input> {
  (input: Input): Output;
}

export interface ParamBindingOption<T, R> {
  transform?: Transformer<T, R>;
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

const PARAM_BINDING_KEY = Symbol('PARAM_BINDING_KEY');

export function ensureParamBindingMetadata(target: any): FunctionParamBindingMetadata {
  if (typeof target !== 'function') {
    throw new TypeError('Decorated target for @ParamBinding is not a function');
  }
  let result = Reflect.getMetadata(PARAM_BINDING_KEY, target);
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
      return target.apply(
        self,
        this.args.map((elem, idx) => paramsBindingMetadata[idx].transform(elem)),
      );
    }
  }

  result = {
    paramsMetadata: [],
    invoker: Invoker,
  };

  Reflect.defineMetadata(PARAM_BINDING_KEY, result, target);
  return result;
}

export function ParamBinding<T, R = T>(target: ServiceIdentifier<T>, option: ParamBindingOption<T, R> = {}) {
  return <T, M extends keyof T>(prototype: T, methodName: M, paramIndex: number) => {
    const metadata = ensureParamBindingMetadata(prototype[methodName]);
    if (metadata.paramsMetadata[paramIndex]) {
      throw new ParamBindingError();
    }
    const parameterDecorator = inject(target) as ParameterDecorator;
    decorate(parameterDecorator, metadata.invoker as Constructor<unknown>, paramIndex);

    metadata.paramsMetadata[paramIndex] = Object.assign(
      {target},
      {transform: option.transform ? option.transform : (x: unknown) => x},
    );
  };
}

export function getFunctionParamBindingMetadata(method: Function): FunctionParamBindingMetadata {
  return Reflect.getMetadata(PARAM_BINDING_KEY, method);
}

export function validateFunctionParamBindingMetadata(method: Function): FunctionParamBindingMetadata {
  const paramBindingMapping = ensureParamBindingMetadata(method);
  for (let i = 0; i < method.length; i++) {
    if (!paramBindingMapping.paramsMetadata[i]) {
      throw new Error(`Parameter at position ${i} is not decorated`);
    }
  }
  return paramBindingMapping;
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
