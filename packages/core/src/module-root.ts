import {BindingType, Container, InvokeResult} from '@sensejs/container';
import {ModuleInstance} from './module-instance';
import {Constructor} from './interfaces';
import {BackgroundTaskQueue, ProcessManager} from './builtins';
import {invokeMethod} from './method-invoker';
import {ModuleScanner} from './module-scanner';

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
    try {
      await moduleRoot.start();
      await moduleRoot.run(method);
    } catch (e) {
      error = e;
    } finally {
      await moduleRoot.stop().catch((e) => {
        error = new ModuleShutdownError(e, error);
      });
    }
    if (error) {
      throw error;
    }
  }

  private static async startModule<T>(moduleInstance: ModuleInstance<T>) {
    for (const dependency of moduleInstance.dependencies) {
      await ModuleRoot.startModule(dependency);
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
    await this.backgroundTaskQueue.waitAllTaskFinished();
  }

  public run<K extends keyof T>(method: K): InvokeResult<T, K> {
    return invokeMethod(this.container.createResolveContext(), this.entryModuleInstance.moduleClass, method);
  }
}
