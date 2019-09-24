import {Container} from 'inversify';
import {getModuleMetadata, ModuleLifecycle, ModuleMetadata} from './module';
import {Constructor} from './interfaces';

export class ModuleInstance {

    private setupPromise?: Promise<void>;
    private destroyPromise?: Promise<void>;
    private moduleLifecycle?: ModuleLifecycle;
    private internalInstance?: Object;

    constructor(readonly moduleClass: Constructor<unknown>,
                private readonly container: Container,
                private readonly moduleMetadata: ModuleMetadata = getModuleMetadata(moduleClass)) {
    }

    private async performSetup() {

        this.moduleLifecycle = this.moduleMetadata
            .moduleLifecycleFactory(this.container);
        await this.moduleLifecycle.onCreate(this.moduleMetadata.components);
        this.container.bind(this.moduleClass).toSelf().inSingletonScope();
        this.internalInstance = this.container.get<Object>(this.moduleClass);
    }

    private async performDestroy() {
        if (this.moduleLifecycle) {
            await this.moduleLifecycle.onDestroy();
        }
        this.container.unbind(this.moduleClass);
    }

    async onSetup() {
        if (this.setupPromise) {
            return this.setupPromise;
        }
        this.setupPromise = this.performSetup();
        return this.setupPromise;

    }

    async onDestroy() {
        if (this.destroyPromise) {
            return this.destroyPromise;
        }
        this.destroyPromise = this.performDestroy();
        return this.destroyPromise;

    }
}
