import {ConsoleLoggerBuilder, EntryPoint, Module, ModuleConstructor, ModuleRoot} from '../src';
import {ApplicationRunner, RunOption} from '../src/entry-point';

// import '@sensejs/testing-utility/lib/mock-console';

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

function runModuleForTest(module: ModuleConstructor) {
  return new Promise((resolve) => {
    const logger = new ConsoleLoggerBuilder().build();
    const runOption = Object.assign({}, runOptionFixture, {
      logger, onExit: (exitCode: number) => {
        onExit(exitCode);
        return resolve(exitCode);
      },
    });
    const appRunner = new ApplicationRunner(process, new ModuleRoot(module), runOption, logger);
    return appRunner.run();
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

  test('no module', async () => {
    const promise = runModuleForTest(Module());
    expect(process.exit).not.toHaveBeenCalled();
    emitSignalOnNextTick();
    expect(await promise).toBe(runOptionFixture.normalExitOption.exitCode);
  });

  test('failed on start', async () => {
    class BadModule extends Module() {
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
    class BadModule extends Module() {
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
    class BadModule extends Module() {
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
    class BadModule extends Module() {
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
    class BadModule extends Module() {
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

  test('warn when multiple entrypoint', () => {
    @EntryPoint()
    class A extends Module() {
    }

    expect(() => {
      @EntryPoint()
      class B extends Module() {
      }
    }).toThrow();
  });
});
