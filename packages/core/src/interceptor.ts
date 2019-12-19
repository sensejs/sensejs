import {Container, injectable} from 'inversify';
import {Class, ServiceIdentifier, Constructor} from './interfaces';
import {Inject} from './decorators';
import {Component} from './component';

export abstract class RequestContext {
  abstract bindContextValue<T>(key: ServiceIdentifier<T>, value: T): void;
}

@injectable()
export abstract class RequestInterceptor<Context extends RequestContext = RequestContext> {
  abstract intercept(context: Context, next: () => Promise<void>): Promise<void>;
}

export function composeRequestInterceptor<Context extends RequestContext>(
  container: Container,
  interceptors: Class<RequestInterceptor<Context>>[],
): Constructor<RequestInterceptor<Context>> {
  @Component()
  class ComposedRequestInterceptor extends RequestInterceptor<Context> {
    constructor(@Inject(Container) private container: Container) {
      super();
    }

    async intercept(context: Context, next: () => Promise<void>) {
      let index = -1;

      const dispatch = async (i: number) => {
        if (i <= index) {
          throw new Error('next() called multiple times');
        }
        index = i;
        const fn =
          i === interceptors.length
            ? next
            : async (next: () => Promise<void>) => {
              const interceptor = this.container.get(interceptors[i]);
              await interceptor.intercept(context, next);
            };

        await fn(async () => dispatch(i + 1));
      };

      return dispatch(0);
    }
  }

  container.bind(ComposedRequestInterceptor).toSelf();
  return ComposedRequestInterceptor;
}
