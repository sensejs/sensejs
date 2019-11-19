import {HttpModule} from '@sensejs/http';
import {ExampleController} from './example.controller';
import {RequestTimingInterceptor} from './request-timing.interceptor';
import PublishingModule from '../publishing';
import {InjectLogger, Logger} from '@sensejs/core';

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
  constructor(@InjectLogger(RequestTimingInterceptor) private logger: Logger) {
    super();
  }

  async onCreate() {
    this.logger.info('Creating HTTP Module');
    await super.onCreate();
    this.logger.info('Created HTTP Module');
  }

  async onDestroy() {
    this.logger.info('Destroying HTTP Module');
    await super.onDestroy();
    this.logger.info('Destroyed Example Module');
  }
}
