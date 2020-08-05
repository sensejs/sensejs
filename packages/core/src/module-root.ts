import {Container} from 'inversify';
import {ModuleInstance} from './module-instance';
import {Constructor} from './interfaces';
import {BackgroundTaskQueue, ProcessManager} from './builtins';
import {invokeMethod} from './method-inject';
import {ModuleScanner} from './module-scanner';

export class ModuleShutdownError extends Error {
  constructor(readonly error: unknown, readonly nestedError?: unknown) {
    super(`Failed to shutdown module: ${error}`);
    Error.captureStackTrace(this, ModuleShutdownError);
  }
}

export class RunModuleError extends Error {
  constructor(readonly error: unknown, readonly nestedError?: unknown) {
    super(`Failed to run module, error: ${error}`);
    Error.captureStackTrace(this, RunModuleError);
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
    this.container = new Container({skipBaseClassChecks: true});
    this.container.bind(Container).toConstantValue(this.container);
    if (processManager) {
      this.container.bind(ProcessManager).toConstantValue(processManager);
    }
    this.container.bind(BackgroundTaskQueue).toConstantValue(this.backgroundTaskQueue);
    this.container.bind(ModuleScanner).toConstantValue(this.moduleScanner);
    this.entryModuleInstance = new ModuleInstance<T>(entryModule, this.container, this.moduleInstanceMap);
  }

  static async run<T>(entryModule: Constructor<T>, method: keyof T): Promise<void> {
    let error: unknown = undefined;
    const moduleRoot = new ModuleRoot(entryModule, new ProcessManager((e) => (error = e)));
    try {
      await moduleRoot.start();
      await moduleRoot.run(method);
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

  public run<K extends keyof T>(method: K): T[K] extends (...args: any[]) => infer R ? R : never {
    return invokeMethod(this.container, this.entryModuleInstance.moduleClass, method);
  }
}
