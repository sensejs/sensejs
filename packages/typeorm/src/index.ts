import {
  Component,
  Constructor,
  createLegacyModule,
  createModule,
  Deprecated,
  Inject,
  InjectLogger,
  Logger,
  LoggerModule,
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

const EntityRepositoryMetadataKey = Symbol();

function ensureInjectRepositoryToken(entityConstructor: string | Function): symbol {
  let symbol = Reflect.getOwnMetadata(EntityRepositoryMetadataKey, entityConstructor);
  if (symbol) {
    return symbol;
  }
  const entityName = typeof entityConstructor === 'string' ? entityConstructor : entityConstructor.name;
  symbol = Symbol(`Repository<${entityName}>`);
  Reflect.defineMetadata(EntityRepositoryMetadataKey, symbol, entityConstructor);
  return symbol;
}

export function InjectRepository(entityConstructor: string | Function) {
  const symbol = ensureInjectRepositoryToken(entityConstructor);
  return Inject(symbol);
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
        enumerateEntityAndRepository(entityManager, (constructor, repository) => {
          context.bindContextValue(ensureInjectRepositoryToken(constructor), repository);
        });
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

export function createTypeOrmModule(option: TypeOrmModuleOption): Constructor {
  const optionProvider = provideOptionInjector<ConnectionOptions>(
    option.typeOrmOption,
    option.injectOptionFrom,
    (defaultValue, injectedValue) => {
      const result = Object.assign({}, defaultValue, injectedValue);
      if (typeof result.type !== 'string') {
        throw new Error('invalid TypeORM config, type is missing');
      }
      // TODO: too complex to check connection type is valid, pass it to TypeORM directly
      return result as ConnectionOptions;
    },
  );

  const factoryProvider = provideConnectionFactory(
    (option: ConnectionOptions) => createConnection(option),
    (connection: Connection) => connection.close(),
    Connection,
  );

  @ModuleClass({
    requires: [LoggerModule, createModule(option)],
    factories: [factoryProvider, optionProvider],
  })
  class TypeOrmConnectionModule {
    constructor(
      @Inject(factoryProvider.factory) private factory: InstanceType<typeof factoryProvider.factory>,
      @Inject(optionProvider.provide) private config: ConnectionOptions,
    ) {}

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

  @ModuleClass({
    requires: [TypeOrmConnectionModule],
  })
  class EntityManagerModule {
    private readonly module: ContainerModule;
    private readonly entityManager = this.connection.createEntityManager();

    constructor(
      @Inject(Container) private container: Container,
      @Inject(Connection) private connection: Connection,
    ) {
      this.entityManager = connection.createEntityManager();
      this.module = new ContainerModule(async (bind) => {
        bind(EntityManager).toConstantValue(this.entityManager);
        enumerateEntityAndRepository(this.entityManager, (constructor, repository) => {
          const symbol = ensureInjectRepositoryToken(constructor);
          bind(symbol).toConstantValue(repository);
        });
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

  return createModule({requires: [EntityManagerModule]});
}

export const TypeOrmModule = createLegacyModule(
  createTypeOrmModule,
  'Base class style TypeOrmModule is deprecated, use TypeOrmModuleClass decorator instead',
);
