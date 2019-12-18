import {Container, injectable, inject, decorate} from 'inversify';
import {Constructor, ServiceIdentifier} from './interfaces';

export interface Transformer<Input = any, Output = Input> {
  (input: Input): Output;
}
export class ParamBindingError extends Error {}

export class ParamBindingResolvingError extends Error {
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

interface Invokable {
  call(paramsBindingMetadata: MethodParameterInjectMetadata[], self: any): any;
}

const METHOD_INJECT_KEY = Symbol('METHOD_INJECT_KEY');

export function ensureMethodInjectMetadata(target: any): MethodInjectMetadata {
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

export function resolveInvoker(container: Container, invokerConstructor: Constructor<Invokable>) {
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

export function MethodInject<T, R = T>(target: ServiceIdentifier<T>, option: MethodParameterInjectOption<T, R> = {}) {
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
