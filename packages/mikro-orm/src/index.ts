import {Component, Constructor, Module, ModuleOption, RequestContext, RequestInterceptor, ModuleConstructor} from '@sensejs/core';
import {EntityManager, MikroORM} from 'mikro-orm';
import {AsyncContainerModule, Container, inject} from 'inversify';

interface MikroOrmModuleOption extends ModuleOption {
  entities: Constructor<unknown>[];
  dbName: string;
  baseDir: string;
  entitiesDirs: string[];
  entitiesDirsTs: string[];
}

const EntityRepositoryMetadataKey = Symbol();

function ensureInjectRepositoryToken(entityConstructor: Constructor<unknown>): symbol {
  let symbol = Reflect.get(entityConstructor, EntityRepositoryMetadataKey);
  if (symbol) {
    return symbol;
  }
  symbol = Symbol(entityConstructor.name);
  Reflect.set(entityConstructor, EntityRepositoryMetadataKey, symbol);
  return symbol;
}

function getInjectRepositoryToken(entityConstructor: Constructor<unknown>): symbol | undefined {
  return Reflect.get(entityConstructor, EntityRepositoryMetadataKey);
}

export function InjectRepository(entityConstructor: Constructor<unknown>) {
  const symbol = ensureInjectRepositoryToken(entityConstructor);
  return inject(symbol);
}

export class RepositoryRegister {

  constructor(private entityManager: EntityManager, private entities: Constructor<unknown>[]) {

  }

  registerOnContainer(container: Container) {
    const forkedEntityManager = this.entityManager.fork();
    container.bind(EntityManager).toConstantValue(forkedEntityManager);
    for (const entityClass of this.entities) {
      container.bind<unknown>(ensureInjectRepositoryToken(entityClass))
        .toConstantValue(forkedEntityManager.getRepository(entityClass));
    }

  }

  registerOnHttpInterceptor(httpContext: RequestContext) {
    const forkedEntityManager = this.entityManager.fork();
    httpContext.bindContextValue(EntityManager, forkedEntityManager);
    for (const entityClass of this.entities) {
      const symbol = ensureInjectRepositoryToken(entityClass);
      httpContext.bindContextValue(symbol, forkedEntityManager.getRepository(entityClass));
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
        const ormInstance = await MikroORM.init({
          entities: option.entities,
          dbName: option.dbName,
          baseDir: option.baseDir,
          entitiesDirs: option.entitiesDirs,
          entitiesDirsTs: option.entitiesDirsTs,
        });
        this.ormInstance = ormInstance;
        bind(RepositoryRegister).toConstantValue(new RepositoryRegister(ormInstance.em, option.entities));
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
