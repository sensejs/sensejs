import {Inject, InjectLogger, Logger} from '@sensejs/core';
import {HttpContext} from '@sensejs/http-common';
import {Middleware} from '@sensejs/container';
import {HttpError} from './http-error.js';
import {ValidationError} from 'suretype';

@Middleware()
export class ErrorHandlerMiddleware {
  constructor(@InjectLogger() private logger: Logger, @Inject(HttpContext) private context: HttpContext) {}

  async handle(next: () => Promise<void>): Promise<void> {
    try {
      await next();
    } catch (e) {
      if (e instanceof ValidationError) {
        this.context.response.statusCode = 400;
        this.context.response.data = e.errors;
      } else if (e instanceof HttpError) {
        this.context.response.statusCode = e.statusCode;
        this.context.response.data = {
          errorCode: e.errorCode,
          errorDetail: e.errorDetail,
          errorMessage: e.errorMessage,
        };
        return;
      }

      this.logger.warn('Unrecognized exception raised: ', e);
      this.context.response.statusCode = 500;
      this.context.response.data = e instanceof Error ? e.stack : 'unknown error';
    }
  }
}
