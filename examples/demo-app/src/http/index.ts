import {createHttpModule} from '@sensejs/http-koa-platform';
import {RequestTimingMiddleware} from './request-timing.middleware.js';
import {TracingMiddleware} from './tracing.middleware.js';
import {ErrorHandlerMiddleware} from './error-handler.middleware.js';
import {DatabaseTransactionMiddleware} from '../database/index.js';
import {ExampleController} from './example.controller.js';
import PublishingModule from '../example/index.js';

export default createHttpModule({
  httpOption: {
    listenPort: 3000,
    listenAddress: '0.0.0.0',
  },
  requires: [PublishingModule],
  components: [ExampleController],
  middlewares: [TracingMiddleware, ErrorHandlerMiddleware, RequestTimingMiddleware, DatabaseTransactionMiddleware],
  injectOptionFrom: 'config.http',
});
