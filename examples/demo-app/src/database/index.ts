import {DynamicModuleLoader, Inject, ModuleClass, ModuleScanner, OnModuleCreate, OnModuleDestroy} from '@sensejs/core';
import {SqliteDriver} from '@mikro-orm/sqlite';
import {Constructor, EntityManager, MikroORM, Options} from '@mikro-orm/core';
import {AuthorEntity} from '../example/author.entity';
import {BookEntity} from '../example/book.entity';
import {InterceptProviderClass} from '@sensejs/container';
import PublishingModule from '../example';
import {EXPORT_ENTITY} from '../constants';

@InterceptProviderClass(EntityManager)
export class DatabaseTransactionInterceptor {
  constructor(@Inject(EntityManager) private globalEntityManager: EntityManager) {}

  async intercept(next: (em: EntityManager) => Promise<any>) {
    const em = this.globalEntityManager.fork({clear: true});
    await next(em);
    await em.flush();
  }
}

@ModuleClass({
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
    const mikroOrm = await MikroORM.init<SqliteDriver>({
      type: 'sqlite',
      dbName: ':memory:',
      entities,
    });
    await mikroOrm.getSchemaGenerator().createSchema();
    loader.addConstant({provide: MikroORM, value: mikroOrm});
    loader.addConstant({provide: EntityManager, value: mikroOrm.em});
  }

  @OnModuleDestroy()
  async onDestroy(): Promise<void> {}
}
