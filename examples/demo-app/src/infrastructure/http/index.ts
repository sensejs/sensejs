import {createHttpModule} from '@sensejs/http';
import {RequestTimingInterceptor} from './request-timing.interceptor';
import {TracingInterceptor} from './tracing-interceptor';
import {TypeOrmSupportInterceptor} from '@sensejs/typeorm';
import {ErrorHandlerInterceptor} from './error-handler.interceptor';

export default createHttpModule({
  httpOption: {
    listenPort: 3000,
    listenAddress: '0.0.0.0',
  },
  // requires: [PublishingModule],
  // components: [ExampleController],
  globalInterceptors: [
    TracingInterceptor,
    ErrorHandlerInterceptor,
    RequestTimingInterceptor,
    TypeOrmSupportInterceptor,
  ],
  injectOptionFrom: 'config.http',
});
