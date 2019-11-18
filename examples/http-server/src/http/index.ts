import {HttpModule} from '@sensejs/http';
import {ExampleController} from './example.controller';
import {RequestTimingInterceptor} from './request-timing.interceptor';
import PublishingModule from '../publishing';
import logger from '@sensejs/logger';

export default class ExampleHttpModule extends HttpModule({
  httpOption: {
    listenPort: 3000,
    listenAddress: '0.0.0.0',
  },
  requires: [PublishingModule],
  components: [ExampleController, RequestTimingInterceptor],
  globalInterceptors: [RequestTimingInterceptor],
  injectOptionFrom: 'config.http',
}) {
  async onCreate() {
    logger.info('Creating HTTP Module');
    await super.onCreate();
    logger.info('Created HTTP Module');
  }

  async onDestroy() {
    logger.info('Destroying HTTP Module');
    await super.onDestroy();
    logger.info('Destroyed Example Module');
  }
}
