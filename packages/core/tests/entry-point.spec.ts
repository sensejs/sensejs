import {
  ConsoleLoggerBuilder,
  Constructor,
  createModule,
  EntryPoint,
  Inject,
  ModuleClass,
  ModuleRoot,
  OnModuleCreate,
  OnModuleDestroy,
} from '../src';
import {ApplicationRunner, RunOption} from '../src/entry-point';
import {ProcessManager} from '../src/builtin-module';

import '@sensejs/testing-utility/lib/mock-console';

class AppExit extends Error {
  constructor(public readonly exitCode: number) {
    super();
  }
}

const onExit = jest.fn();
const runOptionFixture: Omit<RunOption<number>, 'logger'> = {
  exitSignals: {
    SIGINT: {
      exitCode: 0,
      forcedExitWhenRepeated: true,
    },
    SIGTERM: {
      exitCode: 0,
      forcedExitWhenRepeated: false,
    },
  },
  errorExitOption: {
    exitCode: 101,
    timeout: 100,
  },
  forcedExitOption: {
    forcedExitWhenRepeated: false,
    forcedExitCode: 127,
  },
  normalExitOption: {
    exitCode: 0,
    timeout: 100,
  },
  onExit: (exitCode) => {
    onExit(exitCode);
    return exitCode;
  },
};

function createAppRunner(module: Constructor, onExit: (exitCode: number) => unknown) {

  const logger = new ConsoleLoggerBuilder().build();
  const runOption = Object.assign({}, runOptionFixture, {
    logger, onExit,
  });
  return new ApplicationRunner(process, new ModuleRoot(module), runOption, logger);
}

function runModuleForTest(module: Constructor) {
  return new Promise((resolve) => {
    return createAppRunner(module, resolve).run();
  });
}

function emitSignalOnNextTick(signal: NodeJS.Signals = 'SIGINT') {
  setImmediate(() => {
    // @ts-ignore
    process.emit(signal);
  });
}

describe('Application', () => {
  beforeEach(() => {
    jest.spyOn(process, 'exit').mockImplementation((exitCode: number = 0) => {
      // throw an application to emulate process.exit, not finally block will be executed anyway
      throw new AppExit(exitCode);
    });
  });

  test('shutdown', async () => {

    const runner = createAppRunner(createModule(), (exitCode: number) => {
      expect(exitCode).toBe(0);
      return exitCode;
    });
    const stub = jest.fn();
    const promise = runner.run().then(() => {
      stub();
    });
    runner.shutdown();
    expect(stub).not.toHaveBeenCalled();
    return promise;
  });
  test('forced shutdown', async () => {

    const runner = createAppRunner(createModule(), (exitCode: number) => {
      expect(exitCode).toBe(0);
      return exitCode;
    });
    const stub = jest.fn();
    const promise = runner.run().then(() => {
      stub();
    });
    runner.shutdown(true);
    expect(stub).toHaveBeenCalled();
    return promise;
  });

  test('no module', async () => {
    const promise = runModuleForTest(createModule());
    expect(process.exit).not.toHaveBeenCalled();
    emitSignalOnNextTick();
    expect(await promise).toBe(runOptionFixture.normalExitOption.exitCode);
  });

  test('failed on start', async () => {
    @ModuleClass()
    class BadModule {
      @OnModuleCreate()
      async onCreate() {
        await new Promise((resolve) => setImmediate(resolve));
        throw new Error();
      }
    }

    const promise = runModuleForTest(BadModule);
    expect(onExit).not.toHaveBeenCalled();
    await promise;
    expect(await promise).toBe(runOptionFixture.errorExitOption.exitCode);
  });

  test('failed on stop', async () => {
    @ModuleClass()
    class BadModule {
      @OnModuleDestroy()
      async onDestroy() {
        await new Promise((resolve) => setImmediate(resolve));
        throw new Error();
      }
    }

    const promise = runModuleForTest(BadModule);
    emitSignalOnNextTick();
    expect(await promise).toBe(runOptionFixture.errorExitOption.exitCode);
  });

  test('on caught error', async () => {
    @ModuleClass()
    class BadModule {
      @OnModuleCreate()
      async onCreate() {
        setImmediate(() => {
          process.emit('uncaughtException', new Error());
        });
      }
    }

    const promise = runModuleForTest(BadModule);
    expect(onExit).not.toHaveBeenCalled();
    expect(await promise).toBe(runOptionFixture.errorExitOption.exitCode);
  });

  test('on timeout', async () => {
    @ModuleClass()
    class BadModule {
      @OnModuleDestroy()
      async onDestroy() {
        return new Promise<void>(() => null);
      }
    }

    const promise = runModuleForTest(BadModule);
    emitSignalOnNextTick();
    emitSignalOnNextTick('SIGTERM');
    expect(await promise).toBe(runOptionFixture.errorExitOption.timeout);
  });

  test('on repeated', async () => {
    @ModuleClass()
    class BadModule {
      @OnModuleDestroy()
      async onDestroy() {
        await new Promise<void>(() => null);
      }
    }

    const promise = runModuleForTest(BadModule);
    expect(process.exit).not.toHaveBeenCalled();
    setImmediate(() => {
      // @ts-ignore
      process.emit('SIGINT');
      // @ts-ignore
      setImmediate(() => process.emit('SIGINT'));
    });
    expect(await promise).toBe(runOptionFixture.forcedExitOption.forcedExitCode);
  });

});

describe('@EntrpyPoint', () => {

  const onDestroyStub = jest.fn();

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

  test('warn when multiple entrypoint', () => {
    expect(() => {
      @EntryPoint()
      @ModuleClass()
      class B {
      }
    }).toThrow();
  });

  test('shutdown on demand', async () => {

    await runModuleForTest(GlobalEntryPoint);
    expect(onDestroyStub).toHaveBeenCalled();
  });
});
