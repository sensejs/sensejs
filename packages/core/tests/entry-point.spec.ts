import {EntryPoint, Module, ModuleConstructor} from '../src';
import {runModule} from '../src/entry-point';
import '@sensejs/testing-utility/lib/mock-console';

// beforeEach(() => {
//   jest.spyOn(global.console, 'error').mockImplementation(jest.fn());
//   jest.spyOn(global.console, 'warn').mockImplementation(jest.fn());
//   jest.spyOn(global.console, 'info').mockImplementation(jest.fn());
//   jest.spyOn(global.console, 'log').mockImplementation(jest.fn());
//   jest.spyOn(global.console, 'debug').mockImplementation(jest.fn());
//   jest.spyOn(global.console, 'trace').mockImplementation(jest.fn());
// });

class AppExit extends Error {
  constructor(public readonly exitCode: number) {
    super();
  }
}

function runModuleForTest(module: ModuleConstructor) {
  return new Promise((resolve, reject) => runModule(module, {
    errorExitOption: {
      exitCode: 101,
      timeout: 100,
    },
    normalExitOption: {
      exitCode: 0,
      timeout: 100,
      exitImmediatelyWhenRepeated: true,
    },
    onExit: (exitCode): never => {
      reject(new AppExit(exitCode));
      return undefined as never;
    },
  }));
}

describe('Application', () => {
  beforeEach(() => {
    jest.spyOn(process, 'exit').mockImplementation((exitCode: number = 0) => {
      // throw an application to emulate process.exit, not finally block will be executed anyway
      throw new AppExit(exitCode);
    });
  });
  test('no module', async () => {
    const promise = expect(
      runModuleForTest(Module()).catch((appExit: AppExit) => {
        expect(appExit.exitCode).toBe(0);
        throw appExit;
      }),
    ).rejects.toThrow(AppExit);
    expect(process.exit).not.toHaveBeenCalled();
    // @ts-ignore
    setImmediate(() => process.emit('SIGINT'));
    return promise;
  });

  test('failed on start', async () => {
    class BadModule extends Module() {
      async onCreate() {
        await new Promise((resolve) => setImmediate(resolve));
        throw new Error();
      }
    }

    const promise = expect(
      runModuleForTest(BadModule).catch((appExit: AppExit) => {
        expect(appExit.exitCode).toBe(101);
        throw appExit;
      }),
    ).rejects.toThrow(AppExit);
    expect(process.exit).not.toHaveBeenCalled();
    await promise;
  });

  test('failed on stop', async () => {
    class BadModule extends Module() {
      async onDestroy() {
        await new Promise((resolve) => setImmediate(resolve));
        throw new Error();
      }
    }

    const promise = expect(
      runModuleForTest(BadModule).catch((appExit: AppExit) => {
        expect(appExit.exitCode).toBe(101);
        throw appExit;
      }),
    ).rejects.toThrow(AppExit);
    expect(process.exit).not.toHaveBeenCalled();

    // @ts-ignore
    setImmediate(() => process.emit('SIGINT'));
    await promise;
  });

  test('on caught error', async () => {
    class BadModule extends Module() {
      async onCreate() {
        setImmediate(() => {
          process.emit('uncaughtException', new Error());
        });
      }
    }

    const promise = expect(
      runModuleForTest(BadModule).catch((appExit: AppExit) => {
        expect(appExit.exitCode).toBe(101);
        throw appExit;
      }),
    ).rejects.toThrow(AppExit);
    expect(process.exit).not.toHaveBeenCalled();
    await promise;
  });

  test('on timeout', async () => {
    class BadModule extends Module() {
      async onDestroy() {
        return new Promise<void>(() => null);
      }
    }

    const promise = expect(
      runModuleForTest(BadModule).catch((appExit: AppExit) => {
        expect(appExit.exitCode).toBe(101);
        throw appExit;
      }),
    ).rejects.toThrow(AppExit);
    expect(process.exit).not.toHaveBeenCalled();
    // @ts-ignore
    setImmediate(() => process.emit('SIGINT'));
    await promise;
  });

  test('on repeated', async () => {
    class BadModule extends Module() {
      async onDestroy() {
        return new Promise<void>(() => null);
      }
    }

    const promise = expect(
      runModuleForTest(BadModule).catch((appExit: AppExit) => {
        expect(appExit.exitCode).toBe(101);
        throw appExit;
      }),
    ).rejects.toThrow(AppExit);
    expect(process.exit).not.toHaveBeenCalled();
    setImmediate(() => {
      // @ts-ignore
      process.emit('SIGINT');
      // @ts-ignore
      setImmediate(() => process.emit('SIGINT'));
    });
    await promise;
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
