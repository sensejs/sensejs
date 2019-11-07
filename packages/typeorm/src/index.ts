import {Component, ComponentFactory, Constructor, Module, ModuleConstructor} from '@sensejs/core';
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
    Reflect.defineMetadata(EntityRepositoryMetadataKey, {
        value: symbol,
        enumerable: false,
        configurable: false,
        writable: false
    }, entityConstructor);
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

    registerOnHttpContext(httpContext: HttpContext, connection: Connection) {
        for (const entityMetadata of connection.entityMetadatas) {
            httpContext.bindContextValue(ensureInjectRepositoryToken(entityMetadata.target),
                connection.getRepository(entityMetadata.target));
        }
    }
}

@Component()
export class SenseHttpInterceptor extends HttpInterceptor {

    constructor(
        @inject(Connection) private connection: Connection,
        @inject(RepositoryRegister) private repositoryRegister: RepositoryRegister
    ) {
        super();
    }

    async beforeRequest(context: HttpContext) {
        await this.repositoryRegister.registerOnHttpContext(context, this.connection);
    }

    async afterRequest(context: HttpContext) {

    }
}

@Component()
class TypeOrmConnectionWrapper extends ComponentFactory<Connection> {
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

export function TypeOrmModule(option: TypeOrmModuleOption): ModuleConstructor {

    class TypeOrmConnectionModule extends Module({
        components: [SenseHttpInterceptor],
        factories: [{provide: Connection, factory: TypeOrmConnectionWrapper}]
    }) {

        constructor(@inject(TypeOrmConnectionWrapper) private typeOrmConnectionFactory: TypeOrmConnectionWrapper) {
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
