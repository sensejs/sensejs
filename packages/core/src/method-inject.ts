import {Container, inject, injectable, ResolveContext, ServiceId} from '@sensejs/container';
import {Constructor, ServiceIdentifier} from './interfaces';
import * as utility from '@sensejs/utility';
import {RequestContext, RequestInterceptor} from './interceptor';

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
  call(paramsBindingMetadata: MethodInjectMetadata, target: Function): any;
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

    call(methodInjectMetadata: MethodInjectMetadata, target: Function) {
      if (target.length > 0 && methodInjectMetadata.paramsMetadata.length < target.length) {
        throw new MethodParamInjectError(
          `Target method "${prototype.constructor.name}.${method}" has no enough parameter injection metadata`,
        );
      }
      const self = this.args[0];
      const args = this.args.slice(1);
      return target.apply(
        self,
        args.map((elem, idx) => methodInjectMetadata.paramsMetadata[idx].transform(elem)),
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
  resolveContext: ResolveContext,
  constructor: Constructor<T>,
  methodKey: keyof T,
  // target?: T,
): T[K] extends (...args: any[]) => infer R ? R : never {
  const metadata = ensureMethodInjectMetadata(constructor.prototype, methodKey);
  inject(constructor)(metadata.proxy, undefined, 0);
  const targetMethod = constructor.prototype[methodKey];
  if (typeof targetMethod !== 'function') {
    throw new TypeError(
      `${
        constructor.name
      }.${methodKey} is not a function, typeof targetMethod is ${typeof targetMethod}, typeof method is ${typeof methodKey}`,
    );
  }
  const invoker = resolveContext.setAllowUnbound(true).resolve(metadata.proxy) as MethodInjectProxy;
  return invoker.call(metadata, targetMethod);
}

/**
 * Invoke method with arguments from container
 */
export async function invokeMethodAsync<T extends {}, K extends keyof T>(
  resolveContext: ResolveContext,
  constructor: Constructor<T>,
  methodKey: keyof T,
  interceptors: Constructor<RequestInterceptor>[],
  contextIdentifier?: ServiceId<any>,
): Promise<T[K] extends (...args: any[]) => Promise<infer R> ? R : never> {
  const metadata = ensureMethodInjectMetadata(constructor.prototype, methodKey);
  inject(constructor)(metadata.proxy, undefined, 0);
  const targetMethod = constructor.prototype[methodKey];
  if (typeof targetMethod !== 'function') {
    throw new TypeError(
      `${
        constructor.name
      }.${methodKey} is not a function, typeof targetMethod is ${typeof targetMethod}, typeof method is ${typeof methodKey}`,
    );
  }
  const invoker = await resolveContext.setAllowUnbound(true)
    .resolveAsync(metadata.proxy, {
      interceptors: interceptors.map((interceptor) => {
        return {
          interceptorBuilder: (context: RequestContext, interceptor: RequestInterceptor) => {
            return async (next) => {
              return interceptor.intercept(context, next);
            };
          },
          paramInjectionMetadata: [
            {
              id: contextIdentifier ?? Symbol(),
              optional: !contextIdentifier,
              index: 0,
            },
            {
              id: interceptor,
              optional: false,
              index: 1,
            },
          ],

        };
      }),
    }) as MethodInjectProxy;
  return invoker.call(metadata, targetMethod);
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
    const parameterDecorator = inject(target);
    parameterDecorator(metadata.proxy as Constructor, undefined, paramIndex + 1);

    metadata.paramsMetadata[paramIndex] = Object.assign(
      {target},
      {transform: option.transform ? option.transform : (x: unknown) => x},
    );
  };
}

export type ContextFactory<X> = (
  resolveContext: ResolveContext,
  targetConstructor: Constructor,
  targetMethodKey: keyof any,
) => X;

export interface MethodInvokeOption<X> {
  contextFactory: ContextFactory<X>;
  contextIdentifier?: ServiceIdentifier<X>;
}

export interface MethodInvoker<X extends RequestContext> {
  bind<U>(serviceIdentifier: ServiceIdentifier<U>, x: U): this;

  invoke(option: MethodInvokeOption<X>): Promise<void>;
}

const MethodInvoker = class<X extends RequestContext, T extends {}, K extends keyof T> implements MethodInvoker<X> {
  constructor(
    private readonly resolveContext: ResolveContext,
    private readonly interceptors: Constructor<RequestInterceptor<X>>[],
    private readonly targetConstructor: Constructor<T>,
    private readonly targetMethodKey: K,
  ) {
  }

  bind<U>(serviceIdentifier: ServiceIdentifier<U>, x: U) {
    this.resolveContext.addTemporaryConstantBinding(serviceIdentifier, x);
    return this;
  }

  async invoke(option: MethodInvokeOption<X>) {
    const contextIdentifier = option.contextIdentifier ?? Symbol();
    const context = option.contextFactory(this.resolveContext, this.targetConstructor, this.targetMethodKey);
    this.bind(contextIdentifier, context);
    await invokeMethodAsync(
      this.resolveContext,
      this.targetConstructor,
      this.targetMethodKey,
      this.interceptors,
      contextIdentifier,
    );
  }
};

export class MethodInvokerBuilder<X extends RequestContext> {
  resolveContext?: ResolveContext;

  private constructor(
    private container: Container,
    private readonly interceptors: Constructor<RequestInterceptor<X>>[],
  ) {}

  static create<X extends RequestContext>(container: Container): MethodInvokerBuilder<X> {
    return new MethodInvokerBuilder<X>(container, []);
  }

  setResolveContext(resolveContext: ResolveContext) {
    this.resolveContext = resolveContext;
    return this;
  }

  addInterceptor(...interceptors: Constructor<RequestInterceptor<X>>[]): this {
    this.interceptors.push(...interceptors);
    return this;
  }

  clone(): MethodInvokerBuilder<X> {
    return new MethodInvokerBuilder(this.container, Array.from(this.interceptors));
  }

  build<T extends {}, K extends keyof T>(targetConstructor: Constructor<T>, methodKey: K): MethodInvoker<X> {
    return new MethodInvoker(
      this.resolveContext ?? this.container.createResolveContext(),
      this.interceptors,
      targetConstructor,
      methodKey,
    );
  }
}
