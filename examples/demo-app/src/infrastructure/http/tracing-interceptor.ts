import {Component, Inject, LoggerBuilder} from '@sensejs/core';
import {HttpContext, HttpInterceptor} from '@sensejs/http';
import {SenseLoggerBuilder} from '@sensejs/logger';
import {uuidV1} from '@sensejs/utility';

@Component()
export class TracingInterceptor extends HttpInterceptor {
  constructor(@Inject(SenseLoggerBuilder) private loggerBuilder: SenseLoggerBuilder) {
    super();
  }

  async intercept(context: HttpContext, next: () => Promise<void>): Promise<void> {
    context.bindContextValue(LoggerBuilder, this.loggerBuilder.setTraceId(uuidV1()));
    return next();
  }
}
