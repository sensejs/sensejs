import {jest} from '@jest/globals';
import {
  EntryPoint,
  getModuleMetadata,
  Inject,
  ModuleClass,
  ModuleScanner,
  OnModuleCreate,
  OnModuleDestroy,
  ProcessManager,
} from '../src/index.js';
import '@sensejs/testing-utility/lib/mock-console';

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
    // throw an application to emulate process.exit, not finally block will be executed anyway
    console.log('exit');
    stub(exitCode);
    return undefined as never;
    // throw new EmulateProcessExit('process exit');
  });

  @EntryPoint()
  @ModuleClass()
  class GlobalEntryPoint {
    @OnModuleCreate()
    async onCreate(@Inject(ProcessManager) pm: ProcessManager, @Inject(ModuleScanner) moduleScanner: ModuleScanner) {
      const stub = jest.fn();
      moduleScanner.scanModule(stub);
      expect(stub).toHaveBeenCalledWith(getModuleMetadata(GlobalEntryPoint));
      pm.shutdown();
    }

    @OnModuleDestroy()
    async onDestroy() {
      onDestroyStub();
    }
  }

  expect(() => {
    @EntryPoint()
    @ModuleClass()
    class B {}
  }).toThrow();

  await processExitPromise;
  expect(onDestroyStub).toHaveBeenCalled();
  expect(stub).toHaveBeenCalled();
});
