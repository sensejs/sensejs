import {TypeOrmModule} from '@sensejs/typeorm';
import logger from '@sensejs/logger';
import ConfigModule from '../config';

export default class DatabaseModule extends TypeOrmModule({
  requires: [ConfigModule],
  typeOrmOption: {
    synchronize: true,
    entities: [__dirname + '/../**/*.entity.ts'],
  },
  injectOptionFrom: 'config.database',
}) {
  async onCreate(): Promise<void> {
    logger.info('Creating TypeORM Module');
    await super.onCreate();
    logger.info('Created TypeORM Module');
  }

  async onDestroy() {
    logger.info('Destroying TypeORM Module');
    await super.onDestroy();
    logger.info('Destroyed TypeORM Module');
  }
}
