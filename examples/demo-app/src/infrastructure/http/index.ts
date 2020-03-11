import {createHttpModule} from '@sensejs/http';
import {RequestTimingInterceptor} from './request-timing.interceptor';
import {TracingInterceptor} from './tracing-interceptor';
import {ErrorHandlerInterceptor} from './error-handler.interceptor';
import {AnnounceCommittedEventsInterceptor} from '../../application/common/announce-committed-events.interceptor';
import {RegistrationController} from './registration.controller';
import {ApplicationLayerModule} from '../../application';
import DatabaseModule from '../database';
import {EventModule} from '../event';
import {EntityManagerAttachContextInterceptor} from '../../application/common/entity-manager-attach-context.interceptor';
import {Transactional} from '@sensejs/typeorm';

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
    AnnounceCommittedEventsInterceptor,
    Transactional(),
    EntityManagerAttachContextInterceptor,
  ],
  injectOptionFrom: 'config.http',
});
