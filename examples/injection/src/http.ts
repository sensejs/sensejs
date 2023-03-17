import {randomUUID} from 'crypto';
import {InterceptProviderClass} from '@sensejs/container';
import {LoggerBuilder, Inject, InjectLogger, Logger} from '@sensejs/core';
import {defaultLoggerBuilder} from '@sensejs/logger';
import {createKoaHttpModule} from '@sensejs/http-koa-platform';
import {RandomNumberModule} from './random-number.module.js';
import {SenseLogModule} from '@sensejs/logger';

const REQUEST_ID = Symbol('REQUEST_ID');

@InterceptProviderClass(REQUEST_ID)
class RequestIdProviderInterceptProvider {
  async intercept(next: (requestId: string) => Promise<void>) {
    const requestId = randomUUID();
    await next(requestId);
  }
}

@InterceptProviderClass(LoggerBuilder)
class ContextualLoggingInterceptor {
  constructor(
    // It'll be injected with value provided by previous interceptor
    @Inject(REQUEST_ID) private requestId: string,
    // It'll be injected with globally defined LoggerBuilder
    @InjectLogger() private logger: Logger,
  ) {}

  async intercept(next: (lb: LoggerBuilder) => Promise<void>) {
    this.logger.debug('Associate LoggerBuilder with requestId=%s', this.requestId);
    const slb = defaultLoggerBuilder.setTraceId(this.requestId);
    await next(slb);
  }
}

export const HttpModule = createKoaHttpModule({
  // We need list RandomNumberModule here, so that RandomNumberController can be discovered
  requires: [SenseLogModule, RandomNumberModule],

  // The order must not be changed, since REQUEST_ID is not a valid injetable before RequestIdProviderInterceptor
  globalInterceptProviders: [RequestIdProviderInterceptProvider, ContextualLoggingInterceptor],

  httpOption: {
    listenAddress: 'localhost',
    listenPort: 8080,
  },
});
