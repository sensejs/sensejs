import {PublishingFacade} from './publishing-facade.component';
import {InjectLogger, Logger, Module} from '@sensejs/core';
import DatabaseModule from '../database';
import {SenseLogModule} from '@sensejs/logger';

export default class PublishingModule extends Module({
  requires: [SenseLogModule, DatabaseModule],
  components: [PublishingFacade],
}) {
  constructor(@InjectLogger(DatabaseModule) private logger: Logger) {
    super();
  }

  async onCreate() {
    this.logger.info('Creating Example Module');
    await super.onCreate();
    this.logger.info('Created Example Module');
  }

  async onDestroy() {
    this.logger.info('Destroying Example Module');
    await super.onDestroy();
    this.logger.info('Destroyed Example Module');
  }
}
