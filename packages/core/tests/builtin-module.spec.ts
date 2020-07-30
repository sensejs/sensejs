import {ApplicationRunner, Inject, ModuleClass, ModuleRoot, OnModuleCreate} from '../src';
import {BackgroundTaskQueue, createBuiltinModule} from '../src/builtin-module';
import {ModuleScanner} from '../src/module-scanner';

describe('BuiltinModule', () => {
  test('QueuedTask', async () => {
    let resolvePromise: () => void;
    const longRunningTask = new Promise((resolve) => (resolvePromise = resolve));
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

    @ModuleClass({requires: [createBuiltinModule({entryModule: MyModule, onShutdown: () => null})]})
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
    await moduleRoot.start();
    await moduleRoot.stop().then(() => {
      expect(spy).toHaveBeenCalled();
      stoppedStub();
      expect(moduleScannerStub).toHaveBeenCalled();
    });
  });
});
