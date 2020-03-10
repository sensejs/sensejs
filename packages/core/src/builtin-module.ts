import {createModule, ModuleClass, OnModuleCreate, OnModuleDestroy} from './module';
import {Inject} from './decorators';
import {Component} from './component';
import {ComponentFactory, ComponentScope, Constructor} from './interfaces';
import {ModuleScanner} from './module-scanner';

@Component({scope: ComponentScope.SINGLETON})
export class BackgroundTaskQueue {
  private taskFinished = Promise.resolve<unknown>(undefined);

  dispatch(task: Promise<unknown> | (() => Promise<unknown>)) {
    if (typeof task === 'function') {
      this.taskFinished = this.taskFinished.then(() => task().catch(() => void 0));
    } else {
      this.taskFinished = this.taskFinished.then(() => task);
    }
  }

  waitAllTaskFinished() {
    return this.taskFinished;
  }
}

export class ProcessManager {

  constructor(private shutdownRoutine: () => void) {

  }

  shutdown() {
    this.shutdownRoutine();
  }
}

class ProcessManagerFactory extends ComponentFactory<ProcessManager> {
  private processManager?: ProcessManager;

  setShutdownRoutine(fn: () => void) {
    this.processManager = new ProcessManager(fn);
  }

  build() {
    if (!this.processManager) {
      throw new Error('Process not setup correctly');
    }
    return this.processManager;
  }
}

function createModuleScannerFactory(entryModule: Constructor) {
  const moduleScanner = new ModuleScanner(entryModule);

  class ModuleScannerFactory extends ComponentFactory<ModuleScanner> {
    build() {
      return moduleScanner;
    }
  }

  return {
    provide: ModuleScanner,
    scope: ComponentScope.SINGLETON,
    factory: ModuleScannerFactory,
  };
}

export function createBuiltinModule(option: {
  entryModule: Constructor;
  onShutdown: () => void;
}): Constructor {
  class BuiltinModule {

    @OnModuleCreate()
    onCreate(@Inject(ProcessManagerFactory) factory: ProcessManagerFactory) {
      factory.setShutdownRoutine(option.onShutdown);
    }

    @OnModuleDestroy()
    onDestroy(@Inject(BackgroundTaskQueue) queuedTask: BackgroundTaskQueue) {
      return queuedTask.waitAllTaskFinished();
    }
  }

  ModuleClass({
    requires: [
      createModule({
        components: [BackgroundTaskQueue],
        factories: [
          {
            provide: ProcessManager,
            scope: ComponentScope.SINGLETON,
            factory: ProcessManagerFactory,
          },
          createModuleScannerFactory(option.entryModule),
        ],
      }),
    ],
  })(BuiltinModule);

  return BuiltinModule;

}
