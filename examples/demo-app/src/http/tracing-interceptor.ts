import {Component, Inject, LoggerBuilder, uuidV1} from '@sensejs/core';
import {HttpContext, HttpInterceptor} from '@sensejs/http-common';
import {SenseLoggerBuilder} from '@sensejs/logger';

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
