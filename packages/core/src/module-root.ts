import {Container} from 'inversify';
import {ModuleInstance} from './module-instance';
import {Constructor} from './interfaces';
import {ModuleClass} from './module';
import {createBuiltinModule} from './builtin-module';

export class ModuleShutdownError extends Error {
  constructor(readonly shutdownError: unknown, readonly shutdownReason?: unknown) {
    super();
    Error.captureStackTrace(this, ModuleShutdownError);
  }
}

export interface ModuleRootRunOption {
  afterStartup?: () => Promise<void>;
  beforeShutdown?: () => Promise<void>;
}

/**
 * @private
 */
export class ModuleRoot {
  readonly container: Container = new Container({skipBaseClassChecks: true});
  private readonly moduleInstanceMap: Map<Constructor, ModuleInstance> = new Map();
  private readonly entryModuleInstance: ModuleInstance;

  public constructor(entryModule: Constructor) {
    this.container.bind(Container).toConstantValue(this.container);
    this.entryModuleInstance = new ModuleInstance(entryModule, this.container, this.moduleInstanceMap);
  }

  static create(entryModule: Constructor, onShutdown?: (e?: Error) => void): ModuleRoot {
    class EntryPointModule {}

    const moduleRoot: ModuleRoot = new ModuleRoot(
      ModuleClass({
        requires: [
          createBuiltinModule({
            entryModule: EntryPointModule,
            onShutdown: onShutdown ?? (() => moduleRoot.stop()),
          }),
          entryModule,
        ],
      })(EntryPointModule),
    );
    return moduleRoot;
  }

  static async run(entryModule: Constructor, runOption: ModuleRootRunOption = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      const moduleRoot = this.create(entryModule, (e?: Error) => {
        moduleRoot.stop().then(
          () => {
            if (e) {
              return reject(e);
            }
            return resolve();
          },
          (shutdownError) => reject(new ModuleShutdownError(shutdownError, e)),
        );
      });
      moduleRoot.start().then(() => {});
    });
  }

  public async start(): Promise<void> {
    await this.startModule(this.entryModuleInstance);
  }

  public async stop(): Promise<void> {
    await this.stopModule(this.entryModuleInstance);
  }

  private async startModule(moduleInstance: ModuleInstance) {
    for (const dependency of moduleInstance.dependencies) {
      await this.startModule(dependency);
    }
    await moduleInstance.onSetup();
  }

  private async stopModule(moduleInstance: ModuleInstance) {
    if (--moduleInstance.referencedCounter > 0) {
      return;
    }
    await moduleInstance.onDestroy();
    for (;;) {
      const dependency = moduleInstance.dependencies.pop();
      if (!dependency) {
        return;
      }
      await this.stopModule(dependency);
    }
  }
}
