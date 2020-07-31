import {Container} from 'inversify';
import {ModuleInstance} from './module-instance';
import {Constructor} from './interfaces';
import {ModuleClass} from './module';
import {createBuiltinModule} from './builtin-module';
import {invokeMethod} from './method-inject';

export class ModuleShutdownError extends Error {
  constructor(readonly error: unknown, readonly nestedError?: unknown) {
    super();
    Error.captureStackTrace(this, ModuleShutdownError);
  }
}

export class RunModuleError extends Error {
  constructor(readonly error: unknown, readonly nestedError?: unknown) {
    super();
    Error.captureStackTrace(this, RunModuleError);
  }
}

/**
 * @private
 */
export class ModuleRoot<T extends {} = {}> {
  readonly container: Container = new Container({skipBaseClassChecks: true});
  private readonly moduleInstanceMap: Map<Constructor, ModuleInstance> = new Map();
  private readonly entryModuleInstance: ModuleInstance<T>;
  private readonly entryMethod?: keyof T;
  private runModulePromise?: Promise<void>;

  public constructor(entryModule: Constructor<T>, method?: keyof T) {
    this.container.bind(Container).toConstantValue(this.container);
    this.entryModuleInstance = new ModuleInstance<T>(entryModule, this.container, this.moduleInstanceMap);
    this.entryMethod = method;
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

  static async run<T>(entryModule: Constructor<T>, method: keyof T, onShutdown?: (e?: Error) => any): Promise<void> {
    const moduleRoot = new ModuleRoot(entryModule, method);
    let error: unknown = undefined;
    const builtinModule = new ModuleInstance(
      createBuiltinModule({
        entryModule,
        onShutdown: onShutdown ?? ((e) => (error = e)),
      }),
      moduleRoot.container,
      moduleRoot.moduleInstanceMap,
    );

    await builtinModule.onSetup();
    try {
      await moduleRoot.start();
      try {
        await moduleRoot.run();
      } catch (e) {
        error = new RunModuleError(e, error);
      } finally {
        await moduleRoot.stop().catch((e) => {
          error = new ModuleShutdownError(e, error);
        });
      }
      if (error) {
        throw error;
      }
    } finally {
      await builtinModule.onDestroy();
    }
  }

  private static async startModule<T>(moduleInstance: ModuleInstance<T>) {
    for (const dependency of moduleInstance.dependencies) {
      await this.startModule(dependency);
    }
    await moduleInstance.onSetup();
  }

  private static async stopModule<T>(moduleInstance: ModuleInstance<T>) {
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

  public async start(): Promise<void> {
    await ModuleRoot.startModule(this.entryModuleInstance);
  }

  public async stop(): Promise<void> {
    await ModuleRoot.stopModule(this.entryModuleInstance);
  }

  public async run(): Promise<void> {
    if (this.runModulePromise) {
      return this.runModulePromise;
    }
    this.runModulePromise = this.entryMethod
      ? Promise.resolve(invokeMethod(this.container, this.entryModuleInstance.moduleClass, this.entryMethod))
      : Promise.resolve();
    await this.runModulePromise;
  }
}
