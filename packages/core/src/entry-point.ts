import {ModuleRoot} from './module-root';
import {ModuleConstructor} from './module';
import {consoleLogger, Logger} from './logger';

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
  logger: Logger;
  onExit: (exitCode: number) => never;
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
  logger: consoleLogger,
  onExit: (exitCode) => process.exit(exitCode),
};

function setupEventEmitter(actualRunOption: RunOption, stopApp: (option: ExitOption) => void) {
  const onWarning = () => {
  };
  const onError = (e: any) => {
    actualRunOption.logger.info('Uncaught exception: ', e);
    actualRunOption.logger.info('Going to quit');
    stopApp(actualRunOption.errorExitOption);
  };
  const registerExitSignal = (signal: NodeJS.Signals) => {
    const exitOption = Object.assign({}, actualRunOption.normalExitOption, actualRunOption.exitSignals[signal]);
    process.once(signal, () => {
      actualRunOption.logger.info('Receive signal %s, going to quit', signal);
      stopApp(exitOption);
      if (exitOption.exitImmediatelyWhenRepeated) {
        process.once(signal, () => {
          actualRunOption.logger.info('Receive signal %s again, force quit immediately', signal);
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

export async function runModule(entryModule: ModuleConstructor, runOption: Partial<RunOption> = {}) {
  const actualRunOption = Object.assign({}, defaultRunOption, runOption);
  const moduleRoot = new ModuleRoot(entryModule);
  let stopPromise: Promise<void>;
  const runUntilExit = new Promise<number>((resolve) => {
    let exitCode = 0;
    const stopModuleRoot = async () => {
      try {
        await moduleRoot.stop();
      } catch (e) {
        exitCode = actualRunOption.errorExitOption.exitCode;
      } finally {
        resolve(exitCode);
      }
    };
    const stopApp = (option: ExitOption) => {
      exitCode = option.exitCode;
      if (!stopPromise) {
        stopPromise = stopModuleRoot();
      }
      if (option.timeout > 0) {
        setTimeout(() => {
          resolve(actualRunOption.errorExitOption.exitCode);
        }, option.timeout);
      }
    };
    setupEventEmitter(actualRunOption, stopApp);

    moduleRoot.start().catch((e) => {
      actualRunOption.logger.fatal('Uncaught exception: ', e);
      actualRunOption.logger.fatal('Going to quit');
      stopApp(actualRunOption.errorExitOption);
    });
  }).then((exitCode) => actualRunOption.onExit(exitCode));
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
