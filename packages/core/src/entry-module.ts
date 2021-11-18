import {BindingType, Container, Inject, InvokeResult} from '@sensejs/container';
import {ModuleInstance} from './module-instance.js';
import {Constructor} from './interfaces.js';
import {BackgroundTaskQueue, ProcessManager} from './builtins.js';
import {invokeMethod} from './method-invoker.js';
import {ModuleScanner} from './module-scanner.js';
import {ModuleClass, ModuleMetadataLoader} from './module.js';
import {firstValueFrom, Subject} from 'rxjs';

export class ModuleShutdownError extends Error {
  constructor(readonly error: unknown, readonly nestedError?: unknown) {
    super(`Failed to shutdown module: ${error}`);
    Error.captureStackTrace(this, ModuleShutdownError);
  }
}

export class EntryModule<T extends {} = {}> {
  readonly container: Container;
  private readonly moduleInstanceMap: Map<Constructor, ModuleInstance> = new Map();
  private readonly entryModuleInstance: ModuleInstance<T>;
  private readonly backgroundTaskQueue = new BackgroundTaskQueue();
  private readonly moduleScanner: ModuleScanner;
  private bootstrapPromise?: Promise<void>;
  private startPromise?: Promise<void>;
  private stopPromise?: Promise<void>;
  private shutdownPromise?: Promise<void>;

  public constructor(
    entryModule: Constructor<T>,
    processManager?: ProcessManager,
    loader: ModuleMetadataLoader = new ModuleMetadataLoader(),
  ) {
    this.moduleScanner = new ModuleScanner(entryModule, loader);
    this.container = new Container();
    this.container.addBinding({
      type: BindingType.CONSTANT,
      value: this.container,
      id: Container,
    });
    if (processManager) {
      this.container.addBinding({
        type: BindingType.CONSTANT,
        value: processManager,
        id: ProcessManager,
      });
    }
    this.container.addBinding({
      type: BindingType.CONSTANT,
      value: this.backgroundTaskQueue,
      id: BackgroundTaskQueue,
    });
    this.container.addBinding({
      type: BindingType.CONSTANT,
      value: this.moduleScanner,
      id: ModuleScanner,
    });

    this.entryModuleInstance = new ModuleInstance<T>(entryModule, this.container, loader, this.moduleInstanceMap);
  }

  static async run<T>(entryModule: Constructor<T>, method: keyof T): Promise<void> {
    let error: unknown = undefined;
    const moduleRoot = new EntryModule(entryModule, new ProcessManager((e) => (error = e)));
    await moduleRoot.bootstrap();
    if (error) {
      throw error;
    }
    try {
      await moduleRoot.run(method);
    } catch (e) {
      error = e;
    } finally {
      await moduleRoot.shutdown().catch((e) => {
        error = new ModuleShutdownError(e, error);
      });
    }
    if (error) {
      throw error;
    }
  }

  static async start<T>(entryModule: Constructor<T>, method?: keyof T): Promise<void> {
    let error: unknown = undefined;
    const exitSubject = new Subject<void>();
    const exitPromise = firstValueFrom(exitSubject);

    @ModuleClass({requires: [entryModule]})
    class EntrypointWrapperModule {
      async main(@Inject(Container) container: Container, @Inject(entryModule) entryModuleInstance: T) {
        if (method) {
          await invokeMethod(container.createResolveSession(), entryModule, method);
        }
        return exitPromise;
      }
    }

    const moduleRoot = new EntryModule(
      EntrypointWrapperModule,
      new ProcessManager((e) => {
        error = e;
        exitSubject.next();
      }),
    );

    await moduleRoot.start();
    if (error) {
      throw error;
    }
    try {
      await moduleRoot.run('main');
    } catch (e) {
      error = e;
    } finally {
      await moduleRoot.shutdown().catch((e) => {
        error = new ModuleShutdownError(e, error);
      });
    }
  }

  private static async bootstrapModule<T>(moduleInstance: ModuleInstance<T>) {
    for (const dependency of moduleInstance.dependencies) {
      await EntryModule.bootstrapModule(dependency);
    }
    try {
      await moduleInstance.bootstrap();
    } catch (e) {
      for (const dependency of moduleInstance.dependencies) {
        await EntryModule.shutdownModule(dependency);
      }
      throw e;
    }
  }

  private static async shutdownModule<T>(moduleInstance: ModuleInstance<T>) {
    if (--moduleInstance.referencedCounter > 0) {
      return;
    }
    await moduleInstance.destroy();
    for (;;) {
      const dependency = moduleInstance.dependencies.pop();
      if (!dependency) {
        return;
      }
      await this.shutdownModule(dependency);
    }
  }

  public async start(): Promise<void> {
    if (this.startPromise) {
      return this.startPromise;
    }
    this.startPromise = this.bootstrap().then(() => {
      this.container.validate();
      return this.entryModuleInstance.start();
    });
    return this.startPromise;
  }

  public async bootstrap() {
    if (this.bootstrapPromise) {
      return this.bootstrapPromise;
    }
    this.bootstrapPromise = EntryModule.bootstrapModule(this.entryModuleInstance);
    return this.bootstrapPromise;
  }

  public async stop(): Promise<void> {
    if (this.stopPromise) {
      return this.stopPromise;
    }
    this.stopPromise = this.startPromise
      ? this.startPromise.catch(() => {}).then(() => this.entryModuleInstance.stop())
      : Promise.resolve();
    return this.stopPromise;
  }

  public async shutdown() {
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }
    this.shutdownPromise = this.stop()
      .finally(() => {
        return EntryModule.shutdownModule(this.entryModuleInstance);
      })
      .finally(() => this.backgroundTaskQueue.waitAllTaskFinished());
    return this.shutdownPromise;
  }

  public run<K extends keyof T>(method: K): InvokeResult<T, K> {
    return invokeMethod(this.container.createResolveSession(), this.entryModuleInstance.moduleClass, method);
  }
}
