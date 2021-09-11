import {
  Component,
  Constructor,
  createModule,
  DynamicModuleLoader,
  Inject,
  InjectLogger,
  Logger,
  ModuleClass,
  ModuleOption,
  OnModuleCreate,
  OnModuleDestroy,
  provideConnectionFactory,
  provideOptionInjector,
  ServiceIdentifier,
} from '@sensejs/core';
import {AsyncInterceptProvider, BindingType, Container, InterceptProviderClass} from '@sensejs/container';
import {Connection, ConnectionOptions, createConnection, EntityManager} from 'typeorm';
import {attachLoggerToEntityManager, createTypeOrmLogger} from './logger';

export {attachLoggerToEntityManager} from './logger';

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

function createConnectionModule(option: TypeOrmModuleOption) {
  const optionProvider = provideOptionInjector(option.typeOrmOption, option.injectOptionFrom, mergeTypeOrmConfig);
  const factoryProvider = provideConnectionFactory(createConnection, (conn) => conn.close(), Connection);

  @ModuleClass({requires: [createModule(option)], factories: [factoryProvider, optionProvider]})
  class TypeOrmConnectionModule {
    constructor(@Inject(factoryProvider.factory) private factory: InstanceType<typeof factoryProvider.factory>) {}

    @OnModuleCreate()
    async onCreate(
      @Inject(optionProvider.provide) config: ConnectionOptions,
      @InjectLogger('TypeOrmMigration') migrationLogger: Logger,
      @InjectLogger('TypeOrm') logger: Logger,
    ): Promise<void> {
      if (config.logging === true && !config.logger) {
        config = Object.assign({}, config, {
          logger: createTypeOrmLogger(logger, migrationLogger),
        });
      }
      await this.factory.connect(config);
    }

    @OnModuleDestroy()
    async onDestroy(): Promise<void> {
      await this.factory.disconnect();
    }
  }

  return TypeOrmConnectionModule;
}

export function createTypeOrmModule(option: TypeOrmModuleOption): Constructor {
  @ModuleClass({
    requires: [createConnectionModule(option)],
  })
  class TypeOrmModule {
    private readonly entityManager: EntityManager;

    constructor(
      @Inject(Container) private container: Container,
      @Inject(Connection) private connection: Connection,
      @InjectLogger('TypeOrm') private logger: Logger,
    ) {
      this.entityManager = connection.manager;
      attachLoggerToEntityManager(this.entityManager, this.logger);
    }

    @OnModuleCreate()
    async onCreate(@Inject(DynamicModuleLoader) loader: DynamicModuleLoader) {
      loader.addConstant({
        provide: EntityManagerInjectSymbol,
        value: this.entityManager,
      });
    }

    @OnModuleDestroy()
    async onDestroy() {}
  }

  return TypeOrmModule;
}
