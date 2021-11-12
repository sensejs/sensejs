import {jest} from '@jest/globals';
import {
  ApplicationRunner,
  consoleLogger,
  Constructor,
  createModule,
  Inject,
  ModuleClass,
  OnModuleCreate,
  OnModuleDestroy,
  OnModuleStart,
  OnModuleStop,
  ProcessManager,
  RunnerOption,
  Component,
} from '../src/index.js';
import {Container} from '@sensejs/container';
import events from 'events';
import '@sensejs/testing-utility/lib/mock-console';

const onExit = jest.fn();
class MockedProcess extends events.EventEmitter {
  exit(exitCode: number) {
    onExit(exitCode);
  }
}
const mockedProcess = new MockedProcess();
const runOptionFixture: Omit<RunnerOption<number>, 'logger'> = {
  exitSignals: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    SIGINT: {
      exitCode: 0,
      forcedExitWhenRepeated: true,
    },
    // eslint-disable-next-line @typescript-eslint/naming-convention
    SIGTERM: {
      exitCode: 0,
      forcedExitWhenRepeated: false,
    },
    // eslint-disable-next-line @typescript-eslint/naming-convention
    SIGABRT: {},
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

function createAppRunner() {
  return new (class MockedApplicationRunner extends ApplicationRunner {
    constructor() {
      super(mockedProcess);
    }
  })();

  // return new ApplicationRunner(new MockedProcess());
}

function runForTest<M extends {}, K extends keyof M>(module: Constructor<M>, methodKey: K) {
  return new Promise((resolve) => {
    const runOption: RunnerOption<void> = {
      ...runOptionFixture,
      logger: consoleLogger,
      onExit: (exitCode: number) => {
        resolve(exitCode);
      },
    };
    return createAppRunner().run(module, methodKey, runOption);
  });
}

function runModuleForTest<M extends {}, K extends keyof M>(module: Constructor<M>, methodKey?: K) {
  return new Promise<number>((resolve) => {
    const runOption: RunnerOption<void> = {
      ...runOptionFixture,
      logger: consoleLogger,
      onExit: (exitCode: number) => {
        resolve(exitCode);
      },
    };
    if (methodKey) {
      return createAppRunner().runModule(module, methodKey, runOption);
    }
    return createAppRunner().runModule(module, runOption);
  });
}

function emitSignalOnNextTick(signal: NodeJS.Signals = 'SIGINT') {
  setImmediate(() => {
    // @ts-ignore
    mockedProcess.emit(signal);
  });
}

describe('Application', () => {
  test('print warning', () => {
    const promise = runModuleForTest(createModule());
    setImmediate(() => {
      mockedProcess.emit('warning', new Error('warning'));
      mockedProcess.emit('SIGINT');
    });
    return promise.then(() => {
      expect(console.warn).toHaveBeenCalled();
    });
  });

  test('run module method', async () => {
    const onStart = jest.fn(),
      onStop = jest.fn();
    const onModuleCreate = jest.fn(),
      onModuleDestroy = jest.fn();

    @ModuleClass()
    class TargetModule {
      @OnModuleCreate()
      async onModuleCreate() {
        onModuleCreate();
      }

      @OnModuleStart()
      async onStart() {
        onStart();
      }

      entryPoint(@Inject(ProcessManager) pm: ProcessManager) {
        setImmediate(() => pm.shutdown());
      }

      @OnModuleStop()
      async onStop() {
        onStop();
      }

      @OnModuleCreate()
      async onModuleDestroy() {
        onModuleDestroy();
      }
    }

    const exitCode = await runForTest(TargetModule, 'entryPoint');
    expect(exitCode).toBe(runOptionFixture.normalExitOption.exitCode);
    expect(onModuleCreate).toHaveBeenCalledWith();
    expect(onModuleDestroy).toHaveBeenCalledWith();
    expect(onStart).not.toHaveBeenCalledWith();
    expect(onStop).not.toHaveBeenCalledWith();
    await runModuleForTest(TargetModule, 'entryPoint');
    expect(onStart).toHaveBeenCalledWith();
    expect(onStop).toHaveBeenCalledWith();
  });

  test('run module method fails', async () => {
    @ModuleClass()
    class TargetModule {
      async entryPoint() {
        await new Promise((resolve, reject) => setImmediate(reject, new Error()));
      }
    }

    const exitCode = await runModuleForTest(TargetModule, 'entryPoint');
    expect(exitCode).toBe(runOptionFixture.errorExitOption.exitCode);
  });

  test('error occurred before run module method', async () => {
    const fn = jest.fn();

    @ModuleClass()
    class TargetModule {
      @OnModuleCreate()
      async onModuleCreate() {
        throw new Error();
      }

      async entryPoint() {
        fn();
      }
    }

    const exitCode = await runModuleForTest(TargetModule, 'entryPoint');
    expect(exitCode).toBe(runOptionFixture.errorExitOption.exitCode);
    expect(fn).not.toHaveBeenCalled();
  });

  test('container validation failed', async () => {
    const fn = jest.fn();

    @Component()
    class BadComponent {
      constructor(@Inject('anything') anything: any) {}
    }

    @ModuleClass({components: [BadComponent]})
    class TargetModule {}

    const exitCode = await runModuleForTest(TargetModule);
    expect(exitCode).toBe(runOptionFixture.errorExitOption.exitCode);
    expect(fn).not.toHaveBeenCalled();
  });

  test('create invoker onmodule start', async () => {
    const fn = jest.fn();

    @Component()
    class BadComponent {
      foo(@Inject('anything') anything: any) {}
    }

    @ModuleClass({components: [BadComponent]})
    class TargetModule {
      @OnModuleStart()
      onStart(@Inject(Container) container: Container) {
        container.createMethodInvoker(BadComponent, 'foo', []);
      }
    }

    const exitCode = await runModuleForTest(TargetModule);
    expect(exitCode).toBe(runOptionFixture.errorExitOption.exitCode);
    expect(fn).not.toHaveBeenCalled();
  });

  test('no module', async () => {
    const promise = runModuleForTest(createModule());
    emitSignalOnNextTick();
    expect(await promise).toBe(runOptionFixture.normalExitOption.exitCode);
    expect(console.info).toHaveBeenCalledTimes(1);
  });

  test('app has duplicated bindings', async () => {
    const aOnDestroy = jest.fn();

    @Component()
    class MyComponent {}

    @ModuleClass({
      components: [MyComponent],
    })
    class MyModuleA {
      @OnModuleDestroy()
      onModuleDestroy() {
        aOnDestroy();
      }
    }

    @ModuleClass({
      components: [MyComponent],
      requires: [MyModuleA],
    })
    class BadApp {
      main() {}
    }

    const exitCode = await runModuleForTest(BadApp);
    expect(exitCode).toBe(runOptionFixture.errorExitOption.exitCode);
    expect(aOnDestroy).toHaveBeenCalledTimes(1);
  });

  test('failed on start', async () => {
    @ModuleClass()
    class BadModule {
      @OnModuleCreate()
      async onCreate() {
        // await new Promise((resolve) => setImmediate(resolve));
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
          mockedProcess.emit('uncaughtException', new Error());
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
    // emitSignalOnNextTick();
    emitSignalOnNextTick('SIGTERM');
    expect(await promise).toBe(runOptionFixture.forcedExitOption.forcedExitCode);
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
      mockedProcess.emit('SIGINT');
      // @ts-ignore
      setImmediate(() => mockedProcess.emit('SIGINT'));
    });
    expect(await promise).toBe(runOptionFixture.forcedExitOption.forcedExitCode);
  });
});
