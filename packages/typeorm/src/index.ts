import {
  Constructor,
  DynamicModuleLoader,
  Inject,
  InjectLogger,
  Logger,
  ModuleClass,
  ModuleOption,
  OnModuleCreate,
  OnModuleDestroy,
  Optional,
  ServiceIdentifier,
} from '@sensejs/core';
import {AsyncInterceptProvider, InterceptProviderClass} from '@sensejs/container';
import {Connection, ConnectionOptions, createConnection, EntityManager} from 'typeorm';
import {attachLoggerToEntityManager, createTypeOrmLogger} from './logger.js';
import _ from 'lodash';

export {attachLoggerToEntityManager} from './logger.js';

export interface TypeOrmModuleOption extends ModuleOption {
  typeOrmOption?: Partial<ConnectionOptions>;
  injectOptionFrom?: ServiceIdentifier<Partial<ConnectionOptions>>;
}

function checkEntity(entityConstructor: string | Function, decorator: Function) {
  if (typeof entityConstructor === 'undefined') {
    throw new TypeError(
      `Invalid entity "undefined" for decorator "${decorator.name}. Such error may be caused by cyclic dependencies.`,
    );
  }
}

export const EntityManagerInjectSymbol = Symbol();

export function InjectEntityManager() {
  return Inject(EntityManagerInjectSymbol);
}

export function InjectRepository(entityConstructor: string | Function) {
  checkEntity(entityConstructor, InjectRepository);
  return Inject(EntityManagerInjectSymbol, {
    transform: (entityManager: EntityManager) => entityManager.getRepository(entityConstructor),
  });
}

export function InjectTreeRepository(entityConstructor: string | Function) {
  checkEntity(entityConstructor, InjectTreeRepository);
  return Inject(EntityManagerInjectSymbol, {
    transform: (entityManager: EntityManager) => entityManager.getTreeRepository(entityConstructor),
  });
}

export function InjectMongoRepository(entityConstructor: string | Function) {
  checkEntity(entityConstructor, InjectMongoRepository);
  return Inject(EntityManagerInjectSymbol, {
    transform: (entityManager: EntityManager) => entityManager.getMongoRepository(entityConstructor),
  });
}

export function InjectCustomRepository(entityConstructor: Function) {
  checkEntity(entityConstructor, InjectCustomRepository);
  return Inject(EntityManagerInjectSymbol, {
    transform: (entityManager: EntityManager) => entityManager.getCustomRepository(entityConstructor),
  });
}

export enum TransactionLevel {
  READ_UNCOMMITTED = 'READ UNCOMMITTED',
  READ_COMMITTED = 'READ COMMITTED',
  REPEATABLE_READ = 'REPEATABLE READ',
  SERIALIZABLE = 'SERIALIZABLE',
}

export function Transactional(level?: TransactionLevel): Constructor<AsyncInterceptProvider> {
  @InterceptProviderClass(EntityManagerInjectSymbol)
  class TransactionInterceptor {
    private queryRunner = this.connection.createQueryRunner();

    constructor(@Inject(Connection) private connection: Connection) {}

    async intercept(next: (entityManager: EntityManager) => Promise<void>) {
      try {
        await this.queryRunner.connect();
        const runInTransaction = async (entityManager: EntityManager) => {
          return next(entityManager);
        };

        if (level) {
          return await this.connection.transaction(level, runInTransaction);
        }
        return await this.connection.transaction(runInTransaction);
      } finally {
        await this.queryRunner.release();
      }
    }
  }

  return TransactionInterceptor;
}

function mergeTypeOrmConfig(defaultValue?: Partial<ConnectionOptions>, injectedValue?: Partial<ConnectionOptions>) {
  const result = Object.assign({}, defaultValue, injectedValue);
  if (typeof result.type !== 'string') {
    throw new Error('invalid TypeORM config, type is missing');
  }
  // TODO: too complex to check connection type is valid, pass it to TypeORM directly
  return result as ConnectionOptions;
}

class BaseTypeOrmModule {
  constructor(protected option: ConnectionOptions) {}

  @OnModuleCreate()
  async onModuleCreate(
    @InjectLogger('TypeOrmMigration') migrationLogger: Logger,
    @InjectLogger('TypeOrm') logger: Logger,
    @Inject(DynamicModuleLoader) loader: DynamicModuleLoader,
  ) {
    const config = _.merge({}, {logger: createTypeOrmLogger(logger, migrationLogger)}, this.option);
    const conn = await createConnection(config);
    attachLoggerToEntityManager(conn.manager, logger);
    loader.addConstant({provide: Connection, value: conn});
    loader.addConstant({
      provide: EntityManagerInjectSymbol,
      value: conn.manager,
    });
  }

  @OnModuleDestroy()
  async onModuleDestroy(@Inject(Connection) conn: Connection) {
    await conn.close();
  }
}

export function createTypeOrmModule(option: TypeOrmModuleOption): Constructor {
  const {injectOptionFrom = Symbol(), typeOrmOption, ...rest} = option;

  @ModuleClass({
    ...rest,
  })
  class TypeOrmModule extends BaseTypeOrmModule {
    constructor(@Optional() @Inject(injectOptionFrom) injected: Partial<ConnectionOptions> = {}) {
      super(mergeTypeOrmConfig(typeOrmOption, injected));
    }
  }

  return TypeOrmModule;
}
