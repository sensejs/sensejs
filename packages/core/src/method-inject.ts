import {Container, InvokeResult, ResolveContext, ServiceId} from '@sensejs/container';
import {Constructor, ServiceIdentifier} from './interfaces';
import {RequestContext, RequestInterceptor} from './interceptor';

/**
 * Invoke method with arguments from container
 */
export function invokeMethod<T extends {}, K extends keyof T>(
  resolveContext: ResolveContext,
  constructor: Constructor<T>,
  methodKey: keyof T,
  // target?: T,
): InvokeResult<Constructor<T>, K> {
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
  contextIdentifier?: ServiceId,
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
