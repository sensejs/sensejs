import {Container, inject, injectable, InvokeResult, ResolveContext, ServiceId} from '@sensejs/container';
import {Constructor, ServiceIdentifier, Transformer} from './interfaces';
import {RequestContext, RequestInterceptor} from './interceptor';

export class MethodParamDecorateError extends Error {}

export class MethodParamInjectError extends Error {}

export interface MethodParameterInjectOption<T, R> {
  /**
   * Transform the injected target
   */
  transform?: Transformer<T, R>;
}

interface MethodParameterInjectMetadata {
  target: ServiceIdentifier;
  transform: Transformer;
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
      return target.apply(self, args);
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
): InvokeResult<Constructor<T>, K> {
  // const metadata = ensureMethodInjectMetadata(constructor.prototype, methodKey);
  // inject(constructor)(metadata.proxy, undefined, 0);
  // const targetMethod = constructor.prototype[methodKey];
  // if (typeof targetMethod !== 'function') {
  //   throw new TypeError(
  //     `${
  //       constructor.name
  //     }.${methodKey} is not a function, typeof targetMethod is ${typeof targetMethod}, typeof method is ${typeof methodKey}`,
  //   );
  // }
  // const invoker = resolveContext.setAllowUnbound(true).resolve(metadata.proxy) as MethodInjectProxy;
  // return invoker.call(metadata, targetMethod);
  resolveContext.setAllowUnbound(true);
  return resolveContext.invoke(constructor, methodKey);
}

/**
 * Invoke method with arguments from container
 */
export async function invokeMethodAsync<T extends Constructor, K extends keyof InstanceType<T>>(
  resolveContext: ResolveContext,
  constructor: T,
  methodKey: K,
  interceptors: Constructor<RequestInterceptor>[],
  contextIdentifier?: ServiceId<any>,
): Promise<InvokeResult<T, K>> {
  resolveContext.setAllowUnbound(true);
  try {
    for (const i of interceptors) {
      await resolveContext.intercept({
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
            id: i,
            optional: false,
            index: 1,
          },
        ],
      });
    }
    return resolveContext.invoke(constructor, methodKey);
  } finally {
    await resolveContext.cleanUp();
  }
}

export function MethodInject<T extends {}, R = T>(
  target: ServiceIdentifier<T>,
  option: MethodParameterInjectOption<T, R> = {},
) {
  return inject(target, option?.transform);
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

  invoke(option: MethodInvokeOption<X>): Promise<any>;
}

const MethodInvoker = class<X extends RequestContext, T extends {}, K extends keyof T> implements MethodInvoker<X> {
  constructor(
    private readonly resolveContext: ResolveContext,
    private readonly interceptors: Constructor<RequestInterceptor<X>>[],
    private readonly targetConstructor: Constructor<T>,
    private readonly targetMethodKey: K,
  ) {}

  bind<U>(serviceIdentifier: ServiceIdentifier<U>, x: U) {
    this.resolveContext.addTemporaryConstantBinding(serviceIdentifier, x);
    return this;
  }

  async invoke(option: MethodInvokeOption<X>) {
    const contextIdentifier = option.contextIdentifier ?? Symbol();
    const context = option.contextFactory(this.resolveContext, this.targetConstructor, this.targetMethodKey);
    this.bind(contextIdentifier, context);
    const result = await invokeMethodAsync(
      this.resolveContext,
      this.targetConstructor,
      this.targetMethodKey,
      this.interceptors,
      contextIdentifier,
    );
    await this.resolveContext.cleanUp();
    return result;
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
