import {Container, decorate, inject, injectable} from 'inversify';
import {Abstract, ServiceIdentifier} from './interfaces';

export abstract class RequestContext {
  abstract bindContextValue<T>(key: ServiceIdentifier<T>, value: T): void;
}

@injectable()
export abstract class RequestInterceptor<Context extends RequestContext = RequestContext> {
  abstract intercept(context: Context, next: () => Promise<void>): Promise<void>;
}

export function composeRequestInterceptor<Context extends RequestContext>(
  container: Container,
  interceptors: Abstract<RequestInterceptor<Context>>[],
): Abstract<RequestInterceptor<Context>> {
  @injectable()
  class ComposedRequestInterceptor extends RequestInterceptor<Context> {
    private readonly interceptors: RequestInterceptor<Context>[];

    constructor(...interceptors: RequestInterceptor<Context>[]) {
      super();
      this.interceptors = interceptors;
    }

    async intercept(context: Context, next: () => Promise<undefined>) {
      let index = -1;

      const dispatch = async (i: number) => {
        if (i <= index) {
          throw new Error('next() called multiple times');
        }
        index = i;
        const fn =
          i === this.interceptors.length
            ? next
            : (fn: () => Promise<void>) => this.interceptors[i].intercept(context, fn);

        await fn(() => dispatch(i + 1));
      };

      return dispatch(0);
    }
  }

  interceptors.forEach((interceptorConstructor, idx) => {
    const paramDecorator = inject(interceptorConstructor) as ParameterDecorator;
    decorate(paramDecorator, ComposedRequestInterceptor, idx);
  });

  container.bind(ComposedRequestInterceptor).toSelf();

  return ComposedRequestInterceptor;
}
