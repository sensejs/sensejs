import {createHttpModule} from '@sensejs/http';
import {RequestTimingInterceptor} from './request-timing.interceptor';
import {TracingInterceptor} from './tracing-interceptor';
import {ErrorHandlerInterceptor} from './error-handler.interceptor';
import {TransactionalEventAnnounceInterceptor} from '../../application/common/transactional-event-announce.interceptor';
import {RegistrationController} from './registration.controller';
import {ApplicationLayerModule} from '../../application';
import DatabaseModule from '../database';
import {EventModule} from '../event';

export default createHttpModule({
  httpOption: {
    listenPort: 3000,
    listenAddress: '0.0.0.0',
  },
  requires: [DatabaseModule, EventModule, ApplicationLayerModule],
  components: [RegistrationController],
  globalInterceptors: [
    TracingInterceptor,
    ErrorHandlerInterceptor,
    RequestTimingInterceptor,
    TransactionalEventAnnounceInterceptor,
  ],
  injectOptionFrom: 'config.http',
});
