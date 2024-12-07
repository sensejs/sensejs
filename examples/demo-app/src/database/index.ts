import {DynamicModuleLoader, Constructor, Module, ModuleScanner, OnModuleCreate} from '@sensejs/core';
import {Inject, Middleware} from '@sensejs/container';
import {BetterSqliteDriver, MikroORM as BetterSqliteMikroORM, SqlEntityManager} from '@mikro-orm/better-sqlite';
import {EntityManager, MikroORM} from '@mikro-orm/core';
import PublishingModule from '../example/index.js';
import {EXPORT_ENTITY} from '../constants.js';

@Middleware({
  provides: [EntityManager],
})
export class DatabaseTransactionMiddleware {
  constructor(@Inject(MikroORM) private globalEntityManager: MikroORM) {}

  async handle(next: (em: EntityManager) => Promise<any>) {
    const em = this.globalEntityManager.em.fork({clear: true});
    await next(em);
    await em.flush();
  }
}

@Module({
  requires: [PublishingModule],
})
export class MikroOrmConnectionModule {
  @OnModuleCreate()
  async onCreate(
    @Inject(ModuleScanner) scanner: ModuleScanner,
    @Inject(DynamicModuleLoader) loader: DynamicModuleLoader,
  ): Promise<void> {
    // Discover all entities exported in the dependent modules
    const entities: Constructor[] = [];
    scanner.scanModule((metadata) => {
      const exportedEntities = Reflect.get(metadata.properties ?? {}, EXPORT_ENTITY);
      if (!Array.isArray(exportedEntities)) {
        return;
      }
      exportedEntities.forEach((entity: any) => {
        if (typeof entity === 'function') {
          entities.push(entity);
        }
      });
    });
    const mikroOrm = await BetterSqliteMikroORM.init<BetterSqliteDriver>({
      dbName: ':memory:',
      entities,
    });
    await mikroOrm.getSchemaGenerator().createSchema();
    loader.addConstant({provide: MikroORM, value: mikroOrm});
    loader.addConstant({provide: BetterSqliteMikroORM, value: mikroOrm});
    loader.addConstant({provide: EntityManager, value: mikroOrm.em});
    loader.addConstant({provide: SqlEntityManager, value: mikroOrm.em});
  }
}
