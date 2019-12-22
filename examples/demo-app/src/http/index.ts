import {createHttpModule} from '@sensejs/http';
import {ExampleController} from './example.controller';
import {RequestTimingInterceptor} from './request-timing.interceptor';
import PublishingModule from '../example';
import {TracingInterceptor} from './tracing-interceptor';
import {TypeOrmSupportInterceptor} from '@sensejs/typeorm';
import {ErrorHandlerInterceptor} from './error-handler.interceptor';

export default createHttpModule({
  httpOption: {
    listenPort: 3000,
    listenAddress: '0.0.0.0',
  },
  requires: [PublishingModule],
  components: [ExampleController],
  globalInterceptors: [
    ErrorHandlerInterceptor,
    TracingInterceptor,
    RequestTimingInterceptor,
    TypeOrmSupportInterceptor,
  ],
  injectOptionFrom: 'config.http',
});
