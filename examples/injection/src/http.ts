import {randomUUID} from 'crypto';
import {Middleware} from '@sensejs/container';
import {LoggerBuilder, Inject, InjectLogger, Logger} from '@sensejs/core';
import {defaultLoggerBuilder} from '@sensejs/logger';
import {createKoaHttpModule} from '@sensejs/http-koa-platform';
import {RandomNumberModule} from './random-number.module.js';
import {SenseLogModule} from '@sensejs/logger';

const REQUEST_ID = Symbol('REQUEST_ID');

@Middleware({
  provides: [REQUEST_ID],
})
class RequestIdProviderMiddleware {
  async handle(next: (requestId: string) => Promise<void>) {
    const requestId = randomUUID();
    await next(requestId);
  }
}

@Middleware({
  provides: [LoggerBuilder],
})
class ContextualLoggingMiddleware {
  constructor(
    // It'll be injected with value provided by previous interceptor
    @Inject(REQUEST_ID) private requestId: string,
    // It'll be injected with globally defined LoggerBuilder
    @InjectLogger() private logger: Logger,
  ) {}

  async handle(next: (lb: LoggerBuilder) => Promise<void>) {
    this.logger.debug('Associate LoggerBuilder with requestId=%s', this.requestId);
    const slb = defaultLoggerBuilder.setTraceId(this.requestId);
    await next(slb);
  }
}

export const HttpModule = createKoaHttpModule({
  // We need list RandomNumberModule here, so that RandomNumberController can be discovered
  requires: [SenseLogModule, RandomNumberModule],

  // The order must not be changed, since REQUEST_ID is not a valid injetable before RequestIdProviderInterceptor
  middlewares: [RequestIdProviderMiddleware, ContextualLoggingMiddleware],

  httpOption: {
    listenAddress: 'localhost',
    listenPort: 8080,
  },
});
