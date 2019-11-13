import {EntryPoint, Module} from '../src';
import {runModule} from '../src/entry-point';

class AppExit extends Error {
  constructor(public readonly exitCode: number) {
    super();
  }
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
      runModule(Module()).catch((appExit: AppExit) => {
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
      runModule(BadModule, {
        errorExitOption: {
          exitCode: 2,
          timeout: 1000,
        },
      }).catch((appExit: AppExit) => {
        expect(appExit.exitCode).toBe(2);
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
      runModule(BadModule).catch((appExit: AppExit) => {
        expect(appExit.exitCode).toBe(1);
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
      runModule(BadModule).catch((appExit: AppExit) => {
        expect(appExit.exitCode).toBe(1);
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
      runModule(BadModule, {
        normalExitOption: {
          exitCode: 0,
          timeout: 100,
          exitImmediatelyWhenRepeated: false,
        },
      }).catch((appExit: AppExit) => {
        expect(appExit.exitCode).toBe(1);
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
      runModule(BadModule, {
        normalExitOption: {
          exitCode: 0,
          timeout: 100,
          exitImmediatelyWhenRepeated: true,
        },
      }).catch((appExit: AppExit) => {
        expect(appExit.exitCode).toBe(1);
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
    class A extends Module() {}

    expect(() => {
      @EntryPoint()
      class B extends Module() {}
    }).toThrow();
  });
});
