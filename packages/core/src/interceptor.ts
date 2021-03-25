import {injectable, Container, ResolveContext} from '@sensejs/container';
import {Constructor, ServiceIdentifier} from './interfaces';
import {Component} from './component';
import {createConstructorArgumentTransformerProxy, getConstructorInjectMetadata} from './constructor-inject';

export abstract class RequestContext {
  protected abstract resolveContext: ResolveContext;

  abstract readonly targetConstructor: Constructor;

  abstract readonly targetMethodKey: keyof any;

  bindContextValue<T>(key: ServiceIdentifier<T>, value: T): void {
    this.resolveContext.addTemporaryConstantBinding(key, value);
  };
}

@injectable()
export abstract class RequestInterceptor<Context extends RequestContext = RequestContext> {
  abstract intercept(context: Context, next: () => Promise<void>): Promise<void>;
}

export function composeRequestInterceptor<Context extends RequestContext>(
  container: Container,
  interceptors: Constructor<RequestInterceptor<Context>>[],
): Constructor<RequestInterceptor<Context>> {

  @Component()
  class ComposedRequestInterceptor extends RequestInterceptor<Context> {
    async intercept(context: Context, next: () => Promise<void>) {
      let index = -1;

      const dispatch = async (i: number): Promise<void> => {
        if (i <= index) {
          throw new Error('next() called multiple times');
        }
        index = i;
        if (i < interceptors.length) {
          // return container.get(interceptors[i]).intercept(context, () => dispatch(i + 1));
        }
        return next();
      };

      return dispatch(0);
    }
  }
  container.createResolveContext();
  //
  // container.bind(ComposedRequestInterceptor).toSelf();
  return ComposedRequestInterceptor;
}
