import {Container} from 'inversify';
import {getModuleMetadata, ModuleClass, ModuleConstructor, ModuleLifecycle, ModuleMetadata} from './module';
import {Constructor} from './interfaces';

export class ModuleInstance {

    private setupPromise?: Promise<void>;
    private destroyPromise?: Promise<void>;
    private moduleLifecycle?: ModuleClass;

    constructor(readonly moduleClass: ModuleConstructor,
                private readonly container: Container) {
    }

    private async performSetup() {
        this.container.bind(this.moduleClass).toSelf().inSingletonScope();
        this.moduleLifecycle = this.container.get(this.moduleClass);
        await this.moduleLifecycle!.onCreate(this.container);
    }

    private async performDestroy() {
        if (this.moduleLifecycle) {
            await this.moduleLifecycle.onDestroy(this.container);
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
