import {PublishingFacade} from './publishing-facade.component';
import {Module} from '@sensejs/core';
import DatabaseModule from '../database';
import logger from '@sensejs/logger';

export default class PublishingModule extends Module({components: [PublishingFacade], requires: [DatabaseModule]}) {
  async onCreate() {
    logger.info('Creating Example Module');
    await super.onCreate();
    logger.info('Created Example Module');
  }

  async onDestroy() {
    logger.info('Destroying Example Module');
    await super.onDestroy();
    logger.info('Destroyed Example Module');
  }
}
