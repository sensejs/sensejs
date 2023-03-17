import {Inject, LoggerBuilder} from '@sensejs/core';
import {SenseLoggerBuilder} from '@sensejs/logger';
import {MiddlewareClass} from '@sensejs/container';
import {randomUUID} from 'crypto';

@MiddlewareClass(LoggerBuilder)
export class TracingMiddleware {
  constructor(@Inject(SenseLoggerBuilder) private loggerBuilder: SenseLoggerBuilder) {}

  async handle(next: (loggerBuilder: LoggerBuilder) => Promise<void>): Promise<void> {
    return next(this.loggerBuilder.setTraceId(randomUUID()));
  }
}
