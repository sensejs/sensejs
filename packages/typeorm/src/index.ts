import {Component, ComponentFactory, ComponentScope, Constructor, Module, ModuleConstructor} from '@sensejs/core';
import {HttpContext, HttpInterceptor} from '@sensejs/http';
import {Connection, ConnectionOptions, createConnection} from 'typeorm';
import {inject} from 'inversify';

export interface TypeOrmModuleOption {
    typeOrmOption: ConnectionOptions;
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
export class SenseHttpInterceptor extends HttpInterceptor {

    constructor(
        @inject(Connection) private connection: Connection
    ) {
        super();
    }

    async beforeRequest(context: HttpContext) {
        for (const entityMetadata of this.connection.entityMetadatas) {
            context.bindContextValue(ensureInjectRepositoryToken(entityMetadata.target),
                this.connection.getRepository(entityMetadata.target));
        }
    }

    async afterRequest(context: HttpContext) {

    }
}

export function TypeOrmModule(option: TypeOrmModuleOption): ModuleConstructor {
    @Component({scope: ComponentScope.SINGLETON})
    class TypeOrmConnectionFactory extends ComponentFactory<Connection> {
        private typeOrmConnection?: Connection;

        async connect(option: TypeOrmModuleOption): Promise<Connection> {
            this.typeOrmConnection = await createConnection(option.typeOrmOption);
            return this.typeOrmConnection;
        }

        getAllEntityMetadata() {
            return this.build().entityMetadatas;
        }

        build(): Connection {
            if (!this.typeOrmConnection) {
                throw new Error('TypeORM connection is not yet setup');
            }
            return this.typeOrmConnection;
        }

        async close() {
            if (this.typeOrmConnection) {
                await this.typeOrmConnection.close();
                delete this.typeOrmConnection;
            }
        }
    }

    class TypeOrmConnectionModule extends Module({
        components: [SenseHttpInterceptor],
        // TODO: Factory scope is not correctly defined, set scope to ComponentScope.SINGLETON for work-around
        factories: [{provide: Connection, scope: ComponentScope.SINGLETON, factory: TypeOrmConnectionFactory}]
    }) {

        constructor(@inject(TypeOrmConnectionFactory) private typeOrmConnectionFactory: TypeOrmConnectionFactory) {
            super();
        }

        async onCreate(): Promise<void> {
            super.onCreate();
            await this.typeOrmConnectionFactory.connect(option);
        }

        async onDestroy(): Promise<void> {
            await this.typeOrmConnectionFactory.close();
        }
    }

    return TypeOrmConnectionModule;
}
