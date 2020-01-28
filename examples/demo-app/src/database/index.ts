import {createTypeOrmModule} from '@sensejs/typeorm';

export default createTypeOrmModule({
  typeOrmOption: {
    synchronize: true,
    entities: [__dirname + '/../**/*.entity.*'],
    subscribers: [__dirname + '/../**/*.subscriber.*'],
    logging: true,
  },
  injectOptionFrom: 'config.database',
});
