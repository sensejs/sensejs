import {InjectLogger, Logger} from '@sensejs/core';
import {InterceptProviderClass} from '@sensejs/container';

@InterceptProviderClass()
export class RequestTimingInterceptor {
  constructor(@InjectLogger(RequestTimingInterceptor) private logger: Logger) {}

  async intercept(next: () => Promise<void>): Promise<void> {
    const startDate = Date.now();
    this.logger.info('Request incoming');
    try {
      await next();
    } finally {
      this.logger.info('Response finished in %d ms', Date.now() - startDate);
    }
  }
}
