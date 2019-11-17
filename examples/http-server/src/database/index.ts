import {TypeOrmModule} from '@sensejs/typeorm';
import logger from '@sensejs/logger';

export default class DatabaseModule extends TypeOrmModule({
  typeOrmOption: {
    type: 'sqlite',
    database: 'temp.db',
    synchronize: true,
    entities: [__dirname + '/../**/*.entity.ts'],
  },
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
