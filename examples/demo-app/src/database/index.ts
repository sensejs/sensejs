import {createTypeOrmModule} from '@sensejs/typeorm';

export default createTypeOrmModule({
  typeOrmOption: {
    synchronize: true,
    entities: [__dirname + '/../**/*.entity.*'],
    logging: true,
  },
  injectOptionFrom: 'config.database',
});
