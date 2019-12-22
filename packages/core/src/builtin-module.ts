import {ModuleClass, OnModuleDestroy} from './module';
import {LoggerModule} from './logger';
import {Inject} from './decorators';
import {Component} from './component';
import {ComponentScope} from './interfaces';

@Component({scope: ComponentScope.SINGLETON})
export class BackgroundTaskQueue {
  private taskFinished = Promise.resolve<unknown>(undefined);

  dispatch(task: Promise<unknown> | (() => Promise<unknown>)) {
    if (typeof task === 'function') {
      this.taskFinished = this.taskFinished.then(() => task().finally(() => void 0));
    } else {
      this.taskFinished = this.taskFinished.then(() => task);
    }
  }

  waitAllTaskFinished() {
    return this.taskFinished;
  }
}

@ModuleClass({requires: [LoggerModule], components: [BackgroundTaskQueue]})
export class BuiltinModule {

  @OnModuleDestroy()
  onDestroy(@Inject(BackgroundTaskQueue) queuedTask: BackgroundTaskQueue) {
    return queuedTask.waitAllTaskFinished();
  }
}
