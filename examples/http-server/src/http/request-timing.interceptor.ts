import {HttpInterceptor, HttpContext} from '@sensejs/http';
import logger from '@sensejs/logger';
import {Component} from '@sensejs/core';

@Component()
export class RequestTimingInterceptor extends HttpInterceptor {
  async intercept(context: HttpContext, next: () => Promise<void>): Promise<void> {
    const startDate = Date.now();
    logger.info('Request incoming');
    try {
      await next();
    } finally {
      logger.info('Response finished in %d ms', Date.now() - startDate);
    }
  }
}
