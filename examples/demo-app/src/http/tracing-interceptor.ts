import {Component, InjectLogger, Logger, LoggerFactory} from '@sensejs/core';
import {HttpContext, HttpInterceptor} from '@sensejs/http';
import {defaultLoggerBuilder} from '@sensejs/logger';
import {uuidV1} from '@sensejs/utility';

@Component()
export class TracingInterceptor extends HttpInterceptor {
  constructor(@InjectLogger(TracingInterceptor) private logger: Logger) {
    super();
  }

  async intercept(context: HttpContext, next: () => Promise<void>): Promise<void> {
    context.bindContextValue(LoggerFactory, new LoggerFactory(defaultLoggerBuilder.setTraceId(uuidV1())));
    return next();
  }
}
