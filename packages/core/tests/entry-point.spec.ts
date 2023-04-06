import {jest} from '@jest/globals';
import {
  EntryPoint,
  getModuleMetadata,
  Inject,
  Module,
  ModuleScanner,
  OnModuleCreate,
  OnModuleDestroy,
  ProcessManager,
} from '../src/index.js';
// import '@sensejs/testing-utility/lib/mock-console';

/**
 * Because EntryPoint decorator is coupled to state of global process object,
 * test cannot be splitted into multiple cases.
 */
test('EntryPoint decorator', async () => {
  const onDestroyStub = jest.fn();

  const stub = jest.fn();

  const processExitPromise = new Promise((resolve) => {
    stub.mockImplementation(resolve);
  });

  jest.spyOn(process, 'exit').mockImplementation((exitCode: number = 0): never => {
    stub(exitCode);
    return void 0 as never;
  });

  @EntryPoint()
  @Module()
  class GlobalEntryPoint {
    @OnModuleCreate()
    async onCreate(@Inject(ProcessManager) pm: ProcessManager, @Inject(ModuleScanner) moduleScanner: ModuleScanner) {
      const stub = jest.fn();
      moduleScanner.scanModule(stub);
      expect(stub).toHaveBeenCalledWith(getModuleMetadata(GlobalEntryPoint));

      // Make sure this assertion happens before process.exit to be called, otherwise the exception to be thrown
      // will be ignored by jest and trigger an "unhandledRejection" event
      expect(() => {
        @EntryPoint()
        @Module()
        class B {}
      }).toThrow();

      pm.shutdown();
    }

    @OnModuleDestroy()
    async onDestroy() {
      onDestroyStub();
    }
  }

  await processExitPromise.then(() => {
    expect(onDestroyStub).toHaveBeenCalled();
    expect(stub).toHaveBeenCalled();
  });
});
