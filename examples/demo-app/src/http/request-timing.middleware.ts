import {InjectLogger, Logger} from '@sensejs/core';
import {Middleware} from '@sensejs/container';

@Middleware()
export class RequestTimingMiddleware {
  constructor(@InjectLogger(RequestTimingMiddleware) private logger: Logger) {}

  async handle(next: () => Promise<void>): Promise<void> {
    const startDate = Date.now();
    this.logger.info('Request incoming');
    try {
      await next();
    } finally {
      this.logger.info('Response finished in %d ms', Date.now() - startDate);
    }
  }
}
