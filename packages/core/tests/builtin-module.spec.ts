import {Inject, ModuleClass, ModuleRoot, OnModuleCreate} from '../src';
import {BackgroundTaskQueue, createBuiltinModule} from '../src/builtin-module';

describe('BuiltinModule', () => {
  test('QueuedTask', async () => {

    let resolvePromise: () => void;
    const longRunningTask = new Promise((resolve) => resolvePromise = resolve);
    const originWaitAllTaskFinished = BackgroundTaskQueue.prototype.waitAllTaskFinished;

    function mockedWaitAllTaskFinished(this: BackgroundTaskQueue) {
      const promise = originWaitAllTaskFinished.apply(this);
      expect(stoppedStub).not.toHaveBeenCalled();
      process.nextTick(() => {
        resolvePromise();
      });
      return promise;
    }

    const spy = jest
      .spyOn(BackgroundTaskQueue.prototype, 'waitAllTaskFinished')
      .mockImplementation(mockedWaitAllTaskFinished);

    @ModuleClass({requires: [createBuiltinModule({onShutdown: () => null})]})
    class MyModule {
      @OnModuleCreate()
      onCreate(@Inject(BackgroundTaskQueue) queuedTask: BackgroundTaskQueue) {
        queuedTask.dispatch(longRunningTask);
        queuedTask.dispatch(() => longRunningTask);
      }
    }

    const moduleRoot = new ModuleRoot(MyModule);
    await moduleRoot.start();
    const stoppedStub = jest.fn();
    await moduleRoot.stop().then(() => {
      expect(spy).toHaveBeenCalled();
      stoppedStub();
    });
  });
});
