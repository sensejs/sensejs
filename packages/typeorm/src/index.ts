import {
  Component,
  Module,
  ModuleConstructor,
  ModuleOption,
  provideConnectionFactory,
  provideOptionInjector,
  RequestContext,
  RequestInterceptor,
  ServiceIdentifier,
  Logger,
  InjectLogger,
  LoggerModule,
} from '@sensejs/core';
import {inject} from 'inversify';
import {Connection, EntityManager, ConnectionOptions, createConnection, Logger as TypeOrmLogger} from 'typeorm';

export interface TypeOrmModuleOption extends ModuleOption {
  typeOrmOption?: Partial<ConnectionOptions>;
  injectOptionFrom?: ServiceIdentifier<Partial<ConnectionOptions>>;
}

const EntityRepositoryMetadataKey = Symbol();

function createTypeOrmLogger(logger: Logger, migrationLogger: Logger, queryLogger: Logger): TypeOrmLogger {
  return {
    log(level: 'log' | 'info' | 'warn', message: any) {
      logger[level](message);
    },
    logMigration(message: string): any {
      logger.info(message);
    },
    logQuery(query: string, parameters: any[] = []) {
      queryLogger.debug('Query: ' + query + '\nParameters: ', parameters);
    },
    logQueryError(error: string, query: string, parameters: any[] = []) {
      logger.error(
        'Error occurred when running query: \n' + query + '\nParameter: ' + parameters + '\nError detail: ' + error,
      );
    },
    logQuerySlow(time: number, query: string, parameters?: any[]) {
      logger.warn(
        'The following query is too slow: \n' + query + '\nParameter: ' + parameters + 'Finished within %d ms',
        time,
      );
    },
    logSchemaBuild(message: string): any {
      logger.info(message);
    },
  };
}

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
  return inject(symbol);
}

@Component()
export class TypeOrmSupportInterceptor extends RequestInterceptor {
  constructor(@inject(Connection) private connection: Connection, @InjectLogger() private logger: Logger) {
    super();
  }

  async intercept(context: RequestContext, next: () => Promise<void>) {
    const entityManager = this.connection.createEntityManager();
    context.bindContextValue(EntityManager, entityManager);
    for (const entityMetadata of this.connection.entityMetadatas) {
      const inheritanceTree = entityMetadata.inheritanceTree;
      // this.logger.debug('InheritanceTree: ', inheritanceTree);
      const target = inheritanceTree[0];
      const symbol = ensureInjectRepositoryToken(target);
      // this.logger.debug('Registering: ', entityMetadata.name, target, symbol);
      context.bindContextValue(symbol, entityManager.getRepository(target));
    }
    return await next();
  }
}

export function TypeOrmModule(option: TypeOrmModuleOption): ModuleConstructor {
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

  class TypeOrmConnectionModule extends Module({
    requires: [LoggerModule, Module(option)],
    components: [TypeOrmSupportInterceptor],
    factories: [factoryProvider, optionProvider],
  }) {
    constructor(
      @inject(factoryProvider.factory) private factory: InstanceType<typeof factoryProvider.factory>,
      @inject(optionProvider.provide) private config: ConnectionOptions,
      @InjectLogger('TypeOrm') private logger: Logger,
      @InjectLogger('TypeOrmMigration') private migrationLogger: Logger,
      @InjectLogger('TypeOrmQuery') private queryLogger: Logger,
    ) {
      super();
    }

    async onCreate(): Promise<void> {
      await super.onCreate();
      let config = this.config;
      if (this.config.logging === true && !this.config.logger) {
        config = Object.assign({}, this.config, {
          logger: createTypeOrmLogger(this.logger, this.migrationLogger, this.queryLogger),
        });
      }
      await this.factory.connect(config);
    }

    async onDestroy(): Promise<void> {
      await this.factory.disconnect();
      await super.onDestroy();
    }
  }

  return Module({requires: [TypeOrmConnectionModule]});
}
