import {Abstract, Constructor, Module, ModuleOption, setModuleMetadata} from '@sensejs/core';
import {MikroORM} from 'mikro-orm';
import {inject, AsyncContainerModule, Container} from 'inversify';

interface MikroOrmModuleOption extends ModuleOption {
    entities: Constructor<unknown>[],
}

const EntityRepositoryMetadataKey = Symbol();

function ensureInjectRepositoryToken(entityConstructor: Constructor<unknown>) {
    let symbol = Reflect.get(entityConstructor, EntityRepositoryMetadataKey);
    if (symbol) {
        return symbol;
    }
    symbol = Symbol();
    Reflect.set(entityConstructor, EntityRepositoryMetadataKey, Symbol());
    return symbol;
}

function getInjectRepositoryToken(entityConstructor: Constructor<unknown>): symbol|undefined {
    return Reflect.get(entityConstructor, EntityRepositoryMetadataKey);
}

export function InjectRepository(entityConstructor: Constructor<unknown>) {
    const symbol = ensureInjectRepositoryToken(entityConstructor);
    return inject(symbol);
}



export function MikroOrmModule(option: MikroOrmModuleOption) {

    return (class extends Module(option) {

        ormInstance?: MikroORM;
        ormModule?: AsyncContainerModule;

        async onCreate(container: Container): Promise<void> {
            super.onCreate(container);
            this.ormModule = new AsyncContainerModule(async (bind) => {
                const ormInstance = await MikroORM.init({
                    entities: option.entities,
                    dbName: 'test',
                    baseDir: __dirname,
                    entitiesDirs: [],
                    entitiesDirsTs:[]
                });
                this.ormInstance = ormInstance;
                option.entities.forEach((entityConstructor) => {
                    const repositoryInjectToken = ensureInjectRepositoryToken(entityConstructor);
                    bind(repositoryInjectToken).toDynamicValue(()=> {
                        return ormInstance.em.getRepository(entityConstructor);
                    }).inRequestScope();

                });
            });
            return container.loadAsync(this.ormModule);
        }

        async onDestroy(container: Container): Promise<void> {
            if (this.ormModule) {
                container.unload(this.ormModule);
                this.ormModule = undefined;
            }
            if (this.ormInstance) {
                await this.ormInstance.close();
                this.ormInstance = undefined;
            }
            return super.onDestroy(container);
        }
    });

}



