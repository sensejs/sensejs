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
import {EntityManager, MikroORM, Options} from 'mikro-orm';
import {Container, inject} from 'inversify';

interface MikroOrmModuleOption extends ModuleOption {
  mikroOrmOption?: Partial<Options>;
  injectOptionFrom?: ServiceIdentifier<Options>;
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

function getInjectRepositoryToken(entityConstructor: Constructor<unknown>): symbol | undefined {
  return Reflect.getMetadata(EntityRepositoryMetadataKey, entityConstructor.prototype);
}

export function InjectRepository(entityConstructor: Constructor<unknown>) {
  const symbol = ensureInjectRepositoryToken(entityConstructor.prototype);
  return inject(symbol);
}

export class RepositoryRegister {
  constructor(private entityManager: EntityManager) {}

  registerOnContainer(container: Container) {
    const forkedEntityManager = this.entityManager.fork();
    container.bind(EntityManager).toConstantValue(forkedEntityManager);
    for (const entityMetadata of Object.values(forkedEntityManager.getMetadata().getAll())) {
      container
        .bind<unknown>(ensureInjectRepositoryToken(entityMetadata.prototype))
        .toConstantValue(forkedEntityManager.getRepository(entityMetadata.className));
    }
  }

  registerOnHttpInterceptor(httpContext: RequestContext) {
    const forkedEntityManager = this.entityManager.fork();
    httpContext.bindContextValue(EntityManager, forkedEntityManager);
    for (const entityMetadata of Object.values(forkedEntityManager.getMetadata().getAll())) {
      const symbol = ensureInjectRepositoryToken(entityMetadata.prototype);
      httpContext.bindContextValue(symbol, forkedEntityManager.getRepository(entityMetadata.className));
    }
  }
}

@Component()
export class MikroOrmInterceptor extends RequestInterceptor {
  constructor(
    @inject(EntityManager) private entityManager: EntityManager,
    @inject(RepositoryRegister) private repositoryRegister: RepositoryRegister,
  ) {
    super();
  }

  async intercept(context: RequestContext, next: () => Promise<unknown>) {
    this.repositoryRegister.registerOnHttpInterceptor(context);
    await next();
    await this.entityManager.flush();
  }
}

export function MikroOrmModule(option: MikroOrmModuleOption): ModuleConstructor {
  const optionProvider = provideOptionInjector<Options>(option.mikroOrmOption, option.injectOptionFrom, (a, b) => {
    return Object.assign({}, a, b) as Options;
  });
  const factoryProvider = provideConnectionFactory(
    (option: Options) => MikroORM.init(option),
    (connection) => connection.close(),
  );

  class MikroOrmModule extends Module({
    requires: [Module(option)],
    factories: [factoryProvider, optionProvider],
  }) {
    constructor(
      @inject(factoryProvider.factory) private factory: InstanceType<typeof factoryProvider.factory>,
      @inject(optionProvider.provide) private mikroOrmOption: Options,
    ) {
      super();
    }

    async onCreate(): Promise<void> {
      await super.onCreate();
      await this.factory.connect(this.mikroOrmOption);
    }

    async onDestroy(): Promise<void> {
      await this.factory.disconnect();
      return super.onDestroy();
    }
  }

  return MikroOrmModule;
}
