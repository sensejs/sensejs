import {ModuleClass, OnModuleCreate, OnModuleDestroy} from './module';
import {LoggerModule} from './logger';
import {Inject} from './decorators';
import {Component} from './component';
import {ComponentFactory, ComponentScope, Constructor} from './interfaces';

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
      throw new Error('Process not setu correctly');
    }
    return this.processManager;
  }
}

export function createBuiltinModule(option: {
  onShutdown: () => void;
}): Constructor {
  @ModuleClass({
    requires: [LoggerModule],
    components: [BackgroundTaskQueue],
    factories: [{provide: ProcessManager, scope: ComponentScope.SINGLETON, factory: ProcessManagerFactory}],
  })
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
  return BuiltinModule;

}
