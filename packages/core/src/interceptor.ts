import {Container, injectable} from 'inversify';
import {Constructor, ServiceIdentifier} from './interfaces';
import {Inject} from './decorators';
import {Component} from './component';
import {createConstructorArgumentTransformerProxy, getConstructorInjectMetadata} from './constructor-inject';

export abstract class RequestContext {
  abstract bindContextValue<T>(key: ServiceIdentifier<T>, value: T): void;
}

@injectable()
export abstract class RequestInterceptor<Context extends RequestContext = RequestContext> {
  abstract intercept(context: Context, next: () => Promise<void>): Promise<void>;
}

export function composeRequestInterceptor<Context extends RequestContext>(
  container: Container,
  interceptors: Constructor<RequestInterceptor<Context>>[],
): Constructor<RequestInterceptor<Context>> {
  interceptors.forEach((interceptor) => {
    container.bind(interceptor).to(createConstructorArgumentTransformerProxy(
      interceptor,
      getConstructorInjectMetadata(interceptor),
    ));
  });

  @Component()
  class ComposedRequestInterceptor extends RequestInterceptor<Context> {
    constructor(@Inject(Container) private container: Container) {
      super();
    }

    async intercept(context: Context, next: () => Promise<void>) {
      let index = -1;

      const dispatch = async (i: number): Promise<void> => {
        if (i <= index) {
          throw new Error('next() called multiple times');
        }
        index = i;
        if (i < interceptors.length) {
          return this.container.get(interceptors[i]).intercept(context, () => dispatch(i + 1));
        }
        return next();
      };

      return dispatch(0);
    }
  }

  container.bind(ComposedRequestInterceptor).toSelf();
  return ComposedRequestInterceptor;
}
