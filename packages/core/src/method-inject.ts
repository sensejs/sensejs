import {Container, InvokeResult, ResolveContext} from '@sensejs/container';
import {Constructor, ServiceIdentifier} from './interfaces';
import {RequestContext, RequestInterceptor} from './interceptor';

/**
 * Invoke method with arguments from container
 */
export function invokeMethod<T extends {}, K extends keyof T>(
  resolveContext: ResolveContext,
  constructor: Constructor<T>,
  methodKey: keyof T,
): InvokeResult<Constructor<T>, K> {
  resolveContext.setAllowUnbound(true);
  return resolveContext.invoke(constructor, methodKey);
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
    this.resolveContext.setAllowUnbound(true);
    try {
      for (const i of this.interceptors) {
        await this.resolveContext.intercept({
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
      return invokeMethod(
        this.resolveContext,
        this.targetConstructor,
        this.targetMethodKey,
      );
    } finally {
      await this.resolveContext.cleanUp();
    }
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
