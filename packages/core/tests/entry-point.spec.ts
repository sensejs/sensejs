import {EntryPoint, Inject, ModuleClass, OnModuleCreate, OnModuleDestroy} from '../src';
import {ProcessManager} from '../src/builtin-module';

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
    stub(exitCode);
    return undefined as never;
    // throw new EmulateProcessExit('process exit');
  });

  @EntryPoint()
  @ModuleClass()
  class GlobalEntryPoint {
    @OnModuleCreate()
    async onCreate(@Inject(ProcessManager) pm: ProcessManager) {
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
    class B {
    }
  }).toThrow();

  await processExitPromise;
  expect(onDestroyStub).toHaveBeenCalled();
  expect(stub).toHaveBeenCalled();
});
