import {Component, InjectLogger, Logger} from '@sensejs/core';
import {HttpInterceptor, HttpContext} from '@sensejs/http';
import {HttpError} from './http-error';

@Component()
export class ErrorHandlerInterceptor extends HttpInterceptor {
  constructor(@InjectLogger() private logger: Logger) {
    super();
  }
  async intercept(context: HttpContext, next: () => Promise<void>): Promise<void> {
    try {
      await next();
    } catch (e) {
      if (e instanceof HttpError) {
        context.response.statusCode = e.statusCode;
        context.response.data = {
          errorCode: e.errorCode,
          errorDetail: e.errorDetail,
          errorMessage: e.errorMessage,
        };
        return;
      }

      this.logger.warn('Unrecognized exception raised: ', e);
      throw e;
    }
  }
}
