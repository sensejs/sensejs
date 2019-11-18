import {TypeOrmModule} from '@sensejs/typeorm';
import {SenseLogModule} from '@sensejs/logger';
import ConfigModule from '../config';
import {InjectLogger, Logger} from '@sensejs/core';

export default class DatabaseModule extends TypeOrmModule({
  requires: [SenseLogModule, ConfigModule],
  typeOrmOption: {
    synchronize: true,
    entities: [__dirname + '/../**/*.entity.ts'],
  },
  injectOptionFrom: 'config.database',
}) {
  constructor(@InjectLogger(DatabaseModule) private logger: Logger) {
    super();
  }
  async onCreate(): Promise<void> {
    this.logger.info('Creating TypeORM Module');
    await super.onCreate();
    this.logger.info('Created TypeORM Module');
  }

  async onDestroy() {
    this.logger.info('Destroying TypeORM Module');
    await super.onDestroy();
    this.logger.info('Destroyed TypeORM Module');
  }
}
