import {Container, decorate, inject, injectable} from 'inversify';
import {Constructor, ServiceIdentifier} from './interfaces';
import * as utility from '@sensejs/utility';

export class MethodParamDecorateError extends Error {}

export class MethodParamInjectError extends Error {}

export interface MethodParameterInjectOption<T, R> {
  /**
   * Transform the injected target
   */
  transform?: utility.Transformer<T, R>;
}

interface MethodParameterInjectMetadata {
  target: ServiceIdentifier;
  transform: utility.Transformer;
}

interface MethodInjectMetadata {
  paramsMetadata: MethodParameterInjectMetadata[];
  proxy: Constructor<MethodInjectProxy>;
}

interface MethodInjectProxy {
  call(paramsBindingMetadata: MethodParameterInjectMetadata[], self: any): any;
}

const METHOD_INJECT_KEY = Symbol('METHOD_INJECT_KEY');

export function ensureMethodInjectMetadata(target: any): MethodInjectMetadata {
  if (typeof target !== 'function') {
    throw new TypeError('Decorated target for @MethodInject is not a function');
  }
  let result = Reflect.getMetadata(METHOD_INJECT_KEY, target);
  if (typeof result !== 'undefined') {
    return result;
  }

  @injectable()
  class Proxy implements MethodInjectProxy {
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

export function getMethodInjectMetadata(method: Function): MethodInjectMetadata {
  return Reflect.getMetadata(METHOD_INJECT_KEY, method);
}

export function validateMethodInjectMetadata(method: Function): MethodInjectMetadata {
  const methodInjectMetadata = ensureMethodInjectMetadata(method);
  for (let i = 0; i < method.length; i++) {
    if (!methodInjectMetadata.paramsMetadata[i]) {
      throw new Error(`Parameter at position ${i} is not decorated`);
    }
  }
  return methodInjectMetadata;
}

export function invokeMethod<T>(container: Container, target: T, method: Function) {
  const metadata = getMethodInjectMetadata(method);
  if (!metadata) {
    if (method.length === 0) {
      return method.apply(target);
    }
    throw new MethodParamInjectError(`All parameters of target method "${method.name}" must be decorated with @Inject`);
  }

  if (metadata.paramsMetadata.length !== method.length) {
    throw new MethodParamInjectError(`Target method "${method.name}" has ${method.length} parameters,`
      + ` but only ${metadata.paramsMetadata.length} of them was decorated`);
  }

  const invoker = container.resolve<MethodInjectProxy>(metadata.proxy);
  return invoker.call(metadata.paramsMetadata, target);
}

export function MethodInject<T, R = T>(target: ServiceIdentifier<T>, option: MethodParameterInjectOption<T, R> = {}) {
  return (prototype: {}, methodName: string | symbol, paramIndex: number) => {
    const metadata = ensureMethodInjectMetadata(Reflect.get(prototype, methodName));
    if (metadata.paramsMetadata[paramIndex]) {
      throw new MethodParamDecorateError();
    }
    const parameterDecorator = inject(target) as ParameterDecorator;
    decorate(parameterDecorator, metadata.proxy as Constructor, paramIndex);

    metadata.paramsMetadata[paramIndex] = Object.assign(
      {target},
      {transform: option.transform ? option.transform : (x: unknown) => x},
    );
  };
}
