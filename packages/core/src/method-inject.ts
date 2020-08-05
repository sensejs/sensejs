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
  call(paramsBindingMetadata: MethodInjectMetadata, self: any, target: Function): any;
}

const METHOD_INJECT_PROTOTYPE_METADATA = Symbol('METHOD_INJECT_PROTOTYPE_METADATA');

export type MethodInjectPrototypeMetadata = Map<keyof any, MethodInjectMetadata>;

function createProxy<T extends {}>(prototype: T, method: keyof T) {
  @injectable()
  class Proxy implements MethodInjectProxy {
    private readonly args: unknown[];

    constructor(...args: unknown[]) {
      this.args = args;
    }

    call(methodInjectMetadata: MethodInjectMetadata, self: any, target: Function) {
      if (target.length > 0 && methodInjectMetadata.paramsMetadata.length < target.length) {
        throw new MethodParamInjectError(
          `Target method "${prototype.constructor.name}.${method}" has no enough parameter injection metadata`,
        );
      }
      return target.apply(
        self,
        this.args.map((elem, idx) => methodInjectMetadata.paramsMetadata[idx].transform(elem)),
      );
    }
  }

  return Proxy;
}

export function ensureMethodInjectPrototypeMetadata<T extends {}>(prototype: T): MethodInjectPrototypeMetadata {
  let result = Reflect.getOwnMetadata(METHOD_INJECT_PROTOTYPE_METADATA, prototype);

  if (!result) {
    // Deep copy from parent class
    result = new Map<keyof T, MethodInjectMetadata>(
      Array.from(
        new Map<keyof T, MethodInjectMetadata>(
          Reflect.getMetadata(METHOD_INJECT_PROTOTYPE_METADATA, prototype),
        ).entries(),
      ).map(([key, value]) => {
        const {paramsMetadata} = value;

        return [key, {proxy: createProxy(prototype, key), paramsMetadata: Array.from(paramsMetadata)}];
      }),
    );
  }

  Reflect.defineMetadata(METHOD_INJECT_PROTOTYPE_METADATA, result, prototype);

  return result;
}

export function ensureMethodInjectMetadata<T extends {}>(prototype: T, methodKey: keyof T): MethodInjectMetadata {
  const prototypeMetadata = ensureMethodInjectPrototypeMetadata(prototype);
  let result = prototypeMetadata.get(methodKey);
  if (typeof result !== 'undefined') {
    return result;
  }

  result = {
    paramsMetadata: [],
    proxy: createProxy(prototype, methodKey),
  } as MethodInjectMetadata;

  prototypeMetadata.set(methodKey, result);
  return result;
}

export function validateMethodInjectMetadata<T extends {}>(prototype: T, methodKey: keyof T): void {
  const method = prototype[methodKey];
  if (typeof method !== 'function') {
    throw new TypeError('Target method is not a function');
  }
  const result = ensureMethodInjectMetadata(prototype, methodKey);
  for (let i = 0; i < method.length; i++) {
    if (!result.paramsMetadata[i]) {
      throw new Error(`Parameter at position ${i} is not decorated`);
    }
  }
}

export function getMethodInjectMetadata<T extends {}>(
  constructor: Constructor<T>,
  methodKey: keyof T,
): MethodInjectMetadata | undefined {
  return ensureMethodInjectPrototypeMetadata(constructor.prototype).get(methodKey);
}

/**
 * Invoke method with arguments from container
 */
export function invokeMethod<T extends {}, K extends keyof T>(
  container: Container,
  constructor: Constructor<T>,
  methodKey: keyof T,
  target?: T,
): T[K] extends (...args: any[]) => infer R ? R : never {
  const metadata = getMethodInjectMetadata(constructor, methodKey);
  if (typeof target === 'undefined') {
    target = container.get(constructor);
  }
  const targetMethod = target[methodKey];
  if (typeof targetMethod !== 'function') {
    throw new TypeError(
      `${
        constructor.name
      }.${methodKey} is not a function, typeof targetMethod is ${typeof targetMethod}, typeof method is ${typeof methodKey}`,
    );
  }
  if (!metadata) {
    if (targetMethod.length === 0) {
      return targetMethod.apply(target);
    }
    throw new MethodParamInjectError(`All parameters of target method "${methodKey}" must be decorated with @Inject`);
  }
  const invoker = container.resolve<MethodInjectProxy>(metadata.proxy);
  return invoker.call(metadata, target, targetMethod);
}

export function MethodInject<T extends {}, R = T>(
  target: ServiceIdentifier<T>,
  option: MethodParameterInjectOption<T, R> = {},
) {
  return <P extends {}, K extends keyof P>(prototype: P, methodKey: K, paramIndex: number): void => {
    const metadata = ensureMethodInjectMetadata(prototype, methodKey);
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
