import {
  Component,
  Constructor,
  createModule,
  Deprecated,
  Inject,
  InjectLogger,
  Logger,
  ModuleClass,
  ModuleOption,
  OnModuleCreate,
  OnModuleDestroy,
  provideConnectionFactory,
  provideOptionInjector,
  RequestContext,
  RequestInterceptor,
  ServiceIdentifier,
} from '@sensejs/core';
import {Container, ContainerModule} from 'inversify';
import {Connection, ConnectionOptions, createConnection, EntityManager, Repository} from 'typeorm';
import {createTypeOrmLogger} from './logger';

export interface TypeOrmModuleOption extends ModuleOption {
  typeOrmOption?: Partial<ConnectionOptions>;
  injectOptionFrom?: ServiceIdentifier<Partial<ConnectionOptions>>;
}

export function InjectRepository(entityConstructor: string | Function) {
  return Inject(EntityManager, {transform: (entityManager) => entityManager.getRepository(entityConstructor)});
}

function enumerateEntityAndRepository(
  entityManager: EntityManager,
  callback: <T>(entityConstructor: Constructor<T>, repository: Repository<T>) => void,
) {

  for (const entityMetadata of entityManager.connection.entityMetadatas) {
    const inheritanceTree = entityMetadata.inheritanceTree;
    const constructor = inheritanceTree[0] as Constructor;
    if (entityMetadata.treeType) {
      callback(constructor, entityManager.getTreeRepository(constructor));
    } else {
      callback(constructor, entityManager.getRepository(constructor));
    }
  }
}

@Component()
@Deprecated()
export class TypeOrmSupportInterceptor extends RequestInterceptor {

  async intercept(context: RequestContext, next: () => Promise<void>) {
    return next();
  }
}

export enum TransactionLevel {
  READ_UNCOMMITTED = 'READ UNCOMMITTED',
  READ_COMMITTED = 'READ COMMITTED',
  REPEATABLE_READ = 'REPEATABLE READ',
  SERIALIZABLE = 'SERIALIZABLE'
}

export function Transactional(level?: TransactionLevel): Constructor<RequestInterceptor> {

  @Component()
  class TransactionInterceptor extends RequestInterceptor {

    constructor(@Inject(EntityManager) private entityManager: EntityManager) {
      super();
    }

    async intercept(context: RequestContext, next: () => Promise<void>) {
      const runInTransaction = async (entityManager: EntityManager) => {
        context.bindContextValue(EntityManager, entityManager);
        return next();
      };
      if (level) {
        return this.entityManager.transaction(level, runInTransaction);
      }
      return this.entityManager.transaction(runInTransaction);
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
      @InjectLogger('TypeOrm') logger: Logger,
      @InjectLogger('TypeOrmMigration') migrationLogger: Logger,
      @InjectLogger('TypeOrmQuery') queryLogger: Logger,
    ): Promise<void> {
      if (config.logging === true && !config.logger) {
        config = Object.assign({}, config, {
          logger: createTypeOrmLogger(logger, migrationLogger, queryLogger),
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
    private readonly module: ContainerModule;
    private readonly entityManager = this.connection.createEntityManager();

    constructor(
      @Inject(Container) private container: Container,
      @Inject(Connection) private connection: Connection,
    ) {
      this.entityManager = connection.createEntityManager();
      this.module = new ContainerModule(async (bind) => {
        bind(EntityManager).toConstantValue(this.entityManager);
      });
    }

    @OnModuleCreate()
    async onCreate() {
      this.container.load(this.module);
    }

    @OnModuleDestroy()
    async onDestroy() {
      await this.container.unload(this.module);
    }
  }

  return TypeOrmModule;
}
