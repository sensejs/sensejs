import {ApplicationRunner, RunOption} from '../src/entry-point';
import {
  ConsoleLoggerBuilder,
  Constructor,
  createModule,
  ModuleClass,
  ModuleRoot,
  OnModuleCreate,
  OnModuleDestroy,
} from '../src';
import '@sensejs/testing-utility/lib/mock-console';

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
  printWarning: true,
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
  test('print warning', () => {
    const promise = new Promise((resolve) => {
      const runner = createAppRunner(createModule(), resolve);
      runner.run();
      process.emit('warning', new Error('warning'));
      runner.shutdown();
    });
    // tslint:disable-next-line:no-console
    expect(console.warn).toHaveBeenCalled();
    return promise;
  });

  test('shutdown', async () => {

    const promise = new Promise((resolve) => {
      const runner = createAppRunner(createModule(), resolve);
      runner.run();
      runner.shutdown();
    });
    expect(await promise).toBe(runOptionFixture.normalExitOption.exitCode);
    return promise;
  });

  test('forced shutdown', async () => {
    const promise = new Promise((resolve) => {
      const runner = createAppRunner(createModule(), resolve);
      runner.run();
      runner.shutdown(true);
    });
    expect(await promise).toBe(runOptionFixture.forcedExitOption.forcedExitCode);
    return promise;
  });

  test('no module', async () => {
    const promise = runModuleForTest(createModule());
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
    setImmediate(() => {
      // @ts-ignore
      process.emit('SIGINT');
      // @ts-ignore
      setImmediate(() => process.emit('SIGINT'));
    });
    expect(await promise).toBe(runOptionFixture.forcedExitOption.forcedExitCode);
  });
});
