import {BindingType, Container, InvokeResult} from '@sensejs/container';
import {ModuleInstance} from './module-instance.js';
import {Constructor} from './interfaces.js';
import {BackgroundTaskQueue, ProcessManager} from './builtins.js';
import {invokeMethod} from './method-invoker.js';
import {ModuleScanner} from './module-scanner.js';

export class ModuleShutdownError extends Error {
  constructor(readonly error: unknown, readonly nestedError?: unknown) {
    super(`Failed to shutdown module: ${error}`);
    Error.captureStackTrace(this, ModuleShutdownError);
  }
}

export class ModuleRoot<T extends {} = {}> {
  readonly container: Container;
  private readonly moduleInstanceMap: Map<Constructor, ModuleInstance> = new Map();
  private readonly entryModuleInstance: ModuleInstance<T>;
  private readonly backgroundTaskQueue = new BackgroundTaskQueue();
  private readonly moduleScanner: ModuleScanner;
  private bootstrapPromise?: Promise<void>;
  private startPromise?: Promise<void>;
  private stopPromise?: Promise<void>;
  private shutdownPromise?: Promise<void>;

  public constructor(entryModule: Constructor<T>, processManager?: ProcessManager) {
    this.moduleScanner = new ModuleScanner(entryModule);
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

    this.entryModuleInstance = new ModuleInstance<T>(entryModule, this.container, this.moduleInstanceMap);
  }

  static async run<T>(entryModule: Constructor<T>, method: keyof T): Promise<void> {
    let error: unknown = undefined;
    const moduleRoot = new ModuleRoot(entryModule, new ProcessManager((e) => (error = e)));
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

  private static async bootstrapModule<T>(moduleInstance: ModuleInstance<T>) {
    for (const dependency of moduleInstance.dependencies) {
      await ModuleRoot.bootstrapModule(dependency);
    }
    await moduleInstance.bootstrap();
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
    this.container.validate();
    this.startPromise = this.bootstrap().then(() => this.entryModuleInstance.start());
    return this.startPromise;
  }

  public async bootstrap() {
    if (this.bootstrapPromise) {
      return this.bootstrapPromise;
    }
    this.bootstrapPromise = ModuleRoot.bootstrapModule(this.entryModuleInstance);
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
        return ModuleRoot.shutdownModule(this.entryModuleInstance);
      })
      .finally(() => this.backgroundTaskQueue.waitAllTaskFinished());
    return this.shutdownPromise;
  }

  public run<K extends keyof T>(method: K): InvokeResult<T, K> {
    return invokeMethod(this.container.createResolveSession(), this.entryModuleInstance.moduleClass, method);
  }
}
