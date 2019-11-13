import {ModuleRoot} from './module-root';
import {ModuleConstructor} from './module';

interface ExitOption {
  exitCode: number;
  timeout: number;
}

interface RepeatableExitOption extends ExitOption {
  exitImmediatelyWhenRepeated: boolean;
}

type ExitSignalOption = {
  [signal in NodeJS.Signals]?: Partial<RepeatableExitOption>;
};

interface RunOption {
  normalExitOption: RepeatableExitOption;
  errorExitOption: ExitOption;
  exitSignals: ExitSignalOption;
}

export const defaultExitOption: ExitOption = {
  exitCode: 0,
  timeout: 5000,
};

export const defaultExitFailureOption: ExitOption = {
  exitCode: 1,
  timeout: 5000,
};

export const defaultRunOption: RunOption = {
  normalExitOption: {
    exitCode: 0,
    timeout: 5000,
    exitImmediatelyWhenRepeated: false,
  },
  errorExitOption: {
    exitCode: 1,
    timeout: 5000,
  },
  exitSignals: {
    SIGINT: {
      exitImmediatelyWhenRepeated: true,
    },
    SIGTERM: {},
  },
};

function setupEventEmitter(actualRunOption: RunOption, stopApp: (option: ExitOption) => void) {
  const onWarning = () => {};
  const onError = () => {
    stopApp(actualRunOption.errorExitOption);
  };
  const registerExitSignal = (signal: NodeJS.Signals) => {
    const exitOption = Object.assign({}, actualRunOption.normalExitOption, actualRunOption.exitSignals[signal]);
    process.once(signal, () => {
      stopApp(exitOption);
      if (exitOption.exitImmediatelyWhenRepeated) {
        process.once(signal, () => {
          stopApp(actualRunOption.errorExitOption);
        });
      }
    });
  };
  process.on('warning', onWarning);
  process.on('unhandledRejection', onError);
  process.on('uncaughtException', onError);
  (Object.keys(actualRunOption.exitSignals) as NodeJS.Signals[]).forEach(registerExitSignal);
}

export async function runModule(entryModule: ModuleConstructor, runOption: Partial<RunOption> = {}): Promise<never> {
  const actualRunOption = Object.assign({}, defaultRunOption, runOption);
  const appContext = new ModuleRoot(entryModule);
  let stopPromise: Promise<void>;
  const runUntilExit = new Promise<number>((resolve) => {
    let exitCode = 0;
    const stopApp = (option: ExitOption) => {
      exitCode = option.exitCode;
      if (!stopPromise) {
        stopPromise = appContext
          .stop()
          .catch(() => {
            exitCode = actualRunOption.errorExitOption.exitCode;
          })
          .finally(() => resolve(exitCode));
      }
      if (option.timeout > 0) {
        setTimeout(() => {
          resolve(actualRunOption.errorExitOption.exitCode);
        }, option.timeout);
      }
    };
    setupEventEmitter(actualRunOption, stopApp);

    appContext.start().catch(() => {
      stopApp(actualRunOption.errorExitOption);
    });
  });

  process.exit(await runUntilExit);
}

let entryPointCalled = false;

export function EntryPoint(runOption: Partial<RunOption> = {}) {
  if (entryPointCalled) {
    throw new Error('only one entry point is allowed');
  }
  entryPointCalled = true;

  return (moduleConstructor: ModuleConstructor) => {
    // Need to run module on next tick to ensure all files are loaded?
    process.nextTick(() => runModule(moduleConstructor, runOption));
  };
}
