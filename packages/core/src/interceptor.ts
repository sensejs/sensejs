import {Injectable, ResolveSession} from '@sensejs/container';
import {Constructor, ServiceIdentifier} from './interfaces';

export abstract class RequestContext {
  protected abstract resolveSession: ResolveSession;

  abstract readonly targetConstructor: Constructor;

  abstract readonly targetMethodKey: keyof any;

  bindContextValue<T>(key: ServiceIdentifier<T>, value: T): void {
    this.resolveSession.addTemporaryConstantBinding(key, value);
  }
}

@Injectable()
export abstract class RequestInterceptor<Context extends RequestContext = RequestContext> {
  abstract intercept(context: Context, next: () => Promise<void>): Promise<void>;
}
