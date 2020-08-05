import {Component} from './component';
import {ComponentScope} from './interfaces';

@Component({scope: ComponentScope.SINGLETON})
export class BackgroundTaskQueue {
  private taskFinished = Promise.resolve<unknown>(undefined);

  dispatch(task: Promise<unknown> | (() => Promise<unknown>)): void {
    if (typeof task === 'function') {
      this.taskFinished = this.taskFinished.then(() => task().catch(() => void 0));
    } else {
      this.taskFinished = this.taskFinished.then(() => task);
    }
  }

  async waitAllTaskFinished(): Promise<void> {
    await this.taskFinished;
  }
}

export class ProcessManager {
  constructor(private shutdownRoutine: (e?: Error) => void) {}

  shutdown(e?: Error): void {
    this.shutdownRoutine(e);
  }
}
