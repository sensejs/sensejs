import {createTypeOrmModule} from '@sensejs/typeorm';

export default createTypeOrmModule({
  typeOrmOption: {
    synchronize: true,
    entities: [__dirname + '/../../domains/**/*.entity.*'],
    subscribers: [__dirname + '/../**/*.subscriber.*'],
    logging: true,
  },
  injectOptionFrom: 'config.postgres',
});
