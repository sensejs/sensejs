import {
  Component,
  Constructor,
  Module,
  ModuleConstructor,
  ModuleOption,
  RequestContext,
  RequestInterceptor,
} from '@sensejs/core';
import {Configuration, EntityManager, MikroORM, Options} from 'mikro-orm';
import {AsyncContainerModule, Container, inject} from 'inversify';

interface MikroOrmModuleOption extends ModuleOption {
  mikroOrmOption: Options | Configuration;
}

const EntityRepositoryMetadataKey = Symbol();

function ensureInjectRepositoryToken<T extends {}>(entityConstructor: T): symbol {
  let symbol = Reflect.get(entityConstructor, EntityRepositoryMetadataKey);
  if (symbol) {
    return symbol;
  }
  symbol = Symbol();
  Reflect.defineProperty(entityConstructor, EntityRepositoryMetadataKey, {
    value: symbol,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return symbol;
}

function getInjectRepositoryToken(entityConstructor: Constructor<unknown>): symbol | undefined {
  return Reflect.get(entityConstructor.prototype, EntityRepositoryMetadataKey);
}

export function InjectRepository(entityConstructor: Constructor<unknown>) {
  const symbol = ensureInjectRepositoryToken(entityConstructor.prototype);
  return inject(symbol);
}

export class RepositoryRegister {

  constructor(private entityManager: EntityManager) {

  }

  registerOnContainer(container: Container) {
    const forkedEntityManager = this.entityManager.fork();
    container.bind(EntityManager).toConstantValue(forkedEntityManager);
    for (const entityMetadata of Object.values(forkedEntityManager.getMetadata().getAll())) {
      container.bind<unknown>(ensureInjectRepositoryToken(entityMetadata.prototype))
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
export class SenseHttpInterceptor extends RequestInterceptor {

  constructor(
    @inject(RepositoryRegister) private repositoryRegister: RepositoryRegister,
  ) {
    super();
  }

  async intercept(context: RequestContext, next: () => Promise<unknown>) {
    this.repositoryRegister.registerOnHttpInterceptor(context);
    await next();
  }

}

export function MikroOrmModule(option: MikroOrmModuleOption): ModuleConstructor {

  class MikroOrmModule extends Module(option) {

    ormInstance?: MikroORM;
    ormModule?: AsyncContainerModule;

    constructor(@inject(Container) private container: Container) {
      super();
    }

    async onCreate(): Promise<void> {
      // super.onCreate(container);
      this.ormModule = new AsyncContainerModule(async (bind) => {
        const ormInstance = await MikroORM.init(option.mikroOrmOption);
        this.ormInstance = ormInstance;
        bind(RepositoryRegister).toConstantValue(new RepositoryRegister(ormInstance.em));
      });
      return this.container.loadAsync(this.ormModule);
    }

    async onDestroy(): Promise<void> {
      if (this.ormModule) {
        this.container.unload(this.ormModule);
        this.ormModule = undefined;
      }
      if (this.ormInstance) {
        await this.ormInstance.close();
        this.ormInstance = undefined;
      }
      return super.onDestroy();
    }
  }

  return MikroOrmModule;

}
