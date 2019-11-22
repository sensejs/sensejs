import {
  Component,
  Constructor,
  Module,
  ModuleConstructor,
  ModuleOption,
  provideConnectionFactory,
  provideOptionInjector,
  RequestContext,
  RequestInterceptor,
  ServiceIdentifier,
} from '@sensejs/core';
import {inject} from 'inversify';
import {Connection, ConnectionOptions, createConnection} from 'typeorm';

export interface TypeOrmModuleOption extends ModuleOption {
  typeOrmOption?: Partial<ConnectionOptions>;
  injectOptionFrom?: ServiceIdentifier<Partial<ConnectionOptions>>;
}

const EntityRepositoryMetadataKey = Symbol();

function ensureInjectRepositoryToken<T extends {}>(entityConstructor: T): symbol {
  let symbol = Reflect.getMetadata(EntityRepositoryMetadataKey, entityConstructor);
  if (symbol) {
    return symbol;
  }
  symbol = Symbol();
  Reflect.defineMetadata(EntityRepositoryMetadataKey, symbol, entityConstructor);
  return symbol;
}

export function InjectRepository(entityConstructor: Constructor<unknown>) {
  const symbol = ensureInjectRepositoryToken(entityConstructor);
  return inject(symbol);
}

@Component()
export class TypeOrmSupportInterceptor extends RequestInterceptor {
  constructor(@inject(Connection) private connection: Connection) {
    super();
  }

  async intercept(context: RequestContext, next: () => Promise<void>) {
    for (const entityMetadata of this.connection.entityMetadatas) {
      context.bindContextValue(
        ensureInjectRepositoryToken(entityMetadata.target),
        this.connection.getRepository(entityMetadata.target),
      );
    }
    return next();
  }
}

export function TypeOrmModule(option: TypeOrmModuleOption): ModuleConstructor {
  const optionProvider = provideOptionInjector<ConnectionOptions>(
    option.typeOrmOption,
    option.injectOptionFrom,
    (defaultValue, injectedValue) => {
      const result = Object.assign({}, defaultValue, injectedValue);
      if (typeof result.type !== 'string') {
        throw new Error('invalid typeorm config, type is missing');
      }
      // TODO: too complex to check connection type is valid, pass it to TypeORM directory
      return result as ConnectionOptions;
    },
  );

  const factoryProvider = provideConnectionFactory(
    (option: ConnectionOptions) => createConnection(option),
    (connection: Connection) => connection.close(),
    Connection,
  );

  class TypeOrmConnectionModule extends Module({
    requires: [Module(option)],
    components: [TypeOrmSupportInterceptor],
    factories: [factoryProvider, optionProvider],
  }) {
    constructor(
      @inject(factoryProvider.factory) private factory: InstanceType<typeof factoryProvider.factory>,
      @inject(optionProvider.provide) private config: ConnectionOptions,
    ) {
      super();
    }

    async onCreate(): Promise<void> {
      await super.onCreate();
      await this.factory.connect(this.config);
    }

    async onDestroy(): Promise<void> {
      await this.factory.disconnect();
      await super.onDestroy();
    }
  }

  return Module({requires: [TypeOrmConnectionModule]});
}
