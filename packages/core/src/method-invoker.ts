import {Container, InvokeResult, ResolveContext, ResolveSession} from '@sensejs/container';
import {Constructor, ServiceIdentifier} from './interfaces';
import {RequestContext, RequestInterceptor} from './interceptor';

/**
 * Invoke method with arguments from container
 */
export function invokeMethod<T extends {}, K extends keyof T>(
  resolveContext: ResolveSession,
  constructor: Constructor<T>,
  methodKey: keyof T,
): InvokeResult<T, K> {
  return resolveContext.invoke(constructor, methodKey);
}

export type ContextFactory<X> = (
  resolveContext: ResolveSession,
  targetConstructor: Constructor,
  targetMethodKey: keyof any,
) => X;

export interface MethodInvokeOption<X> {
  resolveSession: ResolveSession;
  contextFactory: ContextFactory<X>;
}

export interface MethodInvoker<X extends RequestContext> {
  invoke(option: MethodInvokeOption<X>): Promise<any>;
}

const MethodInvoker = class<X extends RequestContext, T extends {}, K extends keyof T> implements MethodInvoker<X> {
  constructor(
    private readonly interceptors: Constructor<RequestInterceptor<X>>[],
    private readonly targetConstructor: Constructor<T>,
    private readonly targetMethodKey: K,
  ) {}

  async invoke(option: MethodInvokeOption<X>) {
    const {contextFactory, resolveSession} = option;
    const context = contextFactory(resolveSession, this.targetConstructor, this.targetMethodKey);
    let error;
    let returnValue: any;
    try {
      for (const interceptor of this.interceptors) {
        await resolveSession.intercept({
          interceptorBuilder: () => {
            return async (next) => {
              const instance = resolveSession.construct(interceptor);
              return instance.intercept(context, next);
            };
          },
          paramInjectionMetadata: [],
        });
      }
      returnValue = await invokeMethod(resolveSession, this.targetConstructor, this.targetMethodKey);
    } catch (e) {
      error = e;
    }
    await resolveSession.cleanUp(error);
    return returnValue;
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
    return new MethodInvoker(this.interceptors, targetConstructor, methodKey);
  }
}
