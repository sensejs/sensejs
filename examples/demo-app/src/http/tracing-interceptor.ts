import {Inject, LoggerBuilder, uuidV1} from '@sensejs/core';
import {SenseLoggerBuilder} from '@sensejs/logger';
import {InterceptProviderClass} from '@sensejs/container';

@InterceptProviderClass(LoggerBuilder)
export class TracingInterceptor {
  constructor(@Inject(SenseLoggerBuilder) private loggerBuilder: SenseLoggerBuilder) {}

  async intercept(next: (loggerBuilder: LoggerBuilder) => Promise<void>): Promise<void> {
    return next(this.loggerBuilder.setTraceId(uuidV1()));
  }
}
