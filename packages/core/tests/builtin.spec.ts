import {jest} from '@jest/globals';
import {Inject, ModuleClass, ModuleRoot, OnModuleCreate, BackgroundTaskQueue, ModuleScanner} from '../src/index.js';

describe('BuiltinModule', () => {
  test('QueuedTask', async () => {
    let resolvePromise: () => void;
    const longRunningTask = new Promise<void>((resolve) => (resolvePromise = resolve));
    const originWaitAllTaskFinished = BackgroundTaskQueue.prototype.waitAllTaskFinished;
    const stoppedStub = jest.fn();

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

    const moduleScannerStub = jest.fn();

    @ModuleClass()
    class MyModule {
      @OnModuleCreate()
      onCreate(
        @Inject(BackgroundTaskQueue) queuedTask: BackgroundTaskQueue,
        @Inject(ModuleScanner) moduleScanner: ModuleScanner,
      ) {
        queuedTask.dispatch(longRunningTask);
        queuedTask.dispatch(() => longRunningTask);
        moduleScanner.scanModule(moduleScannerStub);
      }
    }

    const moduleRoot = new ModuleRoot(MyModule);
    await moduleRoot.bootstrap();
    await moduleRoot.shutdown().then(() => {
      expect(spy).toHaveBeenCalled();
      stoppedStub();
      expect(moduleScannerStub).toHaveBeenCalled();
    });
  });
});
