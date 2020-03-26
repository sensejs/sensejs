import {ModuleRoot} from './module-root';
import {ModuleClass} from './module';
import {consoleLogger, Logger} from './logger';
import {Constructor} from './interfaces';
import {createBuiltinModule} from './builtin-module';

interface NormalExitOption {
  exitCode: number;
  timeout: number;
}

interface ForcedExitOption {
  forcedExitCode: number;
  forcedExitWhenRepeated: boolean;
}

interface ExitOption extends NormalExitOption, Partial<ForcedExitOption> {
}

type ExitSignalOption = {
  [signal in NodeJS.Signals]?: Partial<ExitOption>;
};

export interface RunOption<T = never> {
  normalExitOption: NormalExitOption;
  forcedExitOption: ForcedExitOption;
  errorExitOption: ExitOption;
  exitSignals: ExitSignalOption;
  logger: Logger;
  printWarning: boolean;
  onExit: (exitCode: number) => T;
}

export const defaultRunOption: RunOption = {
  normalExitOption: {
    exitCode: 0,
    timeout: 5000,
  },
  forcedExitOption: {
    forcedExitWhenRepeated: false,
    forcedExitCode: 127,
  },
  errorExitOption: {
    exitCode: 1,
    timeout: 5000,
  },
  exitSignals: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    SIGINT: {
      forcedExitWhenRepeated: true,
    },
    // eslint-disable-next-line @typescript-eslint/naming-convention
    SIGTERM: {},
  },
  logger: consoleLogger,
  printWarning: true,
  onExit: (exitCode) => process.exit(exitCode),
};

function provideBuiltin(option: {
  entryModule: Constructor;
  onShutdown: () => void;
}) {
  @ModuleClass({
    requires: [
      createBuiltinModule({
        entryModule: EntryPointModule,
        onShutdown: option.onShutdown,
      }), option.entryModule,
    ],
  })
  class EntryPointModule {}

  return EntryPointModule;
}

export class ApplicationRunner {

  private runPromise?: Promise<unknown>;
  private isStopped = false;
  private logger: Logger = this.runOption.logger;
  private signalHandler = new Map<NodeJS.Signals, () => void>();

  constructor(
    private process: NodeJS.Process,
    private moduleRoot: ModuleRoot,
    private runOption: RunOption<unknown>,
  ) {}

  static runModule(entryModule: Constructor, runOption: Partial<RunOption> = {}) {
    const actualRunOption = Object.assign({}, defaultRunOption, runOption);
    const moduleRoot = new ModuleRoot(provideBuiltin({
      entryModule,
      onShutdown,
    }));
    const runner = new ApplicationRunner(process, moduleRoot, actualRunOption);
    function onShutdown() {
      runner.shutdown();
    }
    return runner.run();
  }

  private onProcessWarning = (e: Error) => {
    if (this.runOption.printWarning) {
      this.logger.warn('Warning: ', e.name);
      this.logger.warn(e.message);
      this.logger.warn(e.stack);
    }
  };
  private onProcessError = (e: any) => {
    this.logger.fatal('Uncaught exception: ', e);
    this.logger.fatal('Going to quit');
    this.stop(this.runOption.errorExitOption);
  };

  shutdown(forced: boolean = false) {
    if (forced) {
      this.forceStop(this.runOption.forcedExitOption);
    } else {
      this.stop();
    }
  }

  run() {
    if (this.runPromise) {
      return this.runPromise;
    }
    this.runPromise = this.performRun();
    return this.runPromise;
  }

  private async performRun() {
    this.setupEventListeners();
    try {
      await this.moduleRoot.start();
    } catch (e) {
      this.logger.fatal('Error occurred when start application: ', e);
      this.logger.fatal('Going to quit');
      this.stop(this.runOption.errorExitOption);
    }
  }

  private forceStop(option: ForcedExitOption) {
    this.runOption.onExit(option.forcedExitCode);
  }

  private stop(option: ExitOption = this.runOption.normalExitOption) {
    if (this.isStopped) {
      return;
    }
    this.isStopped = true;

    let promise = this.stopModuleRoot(option);
    if (option.timeout > 0) {
      promise = Promise.race([
        promise, new Promise<number>((resolve) => {
          setTimeout(() => {
            resolve(this.runOption.errorExitOption.timeout);
          }, option.timeout);
        }),
      ]);
    }
    promise.then((exitCode: number) => {
      return this.runOption.onExit(exitCode);
    });
  }

  private async stopModuleRoot(option: NormalExitOption) {
    try {
      await this.moduleRoot.stop();
    } catch (e) {
      return this.runOption.errorExitOption.exitCode;
    } finally {
      this.clearEventListeners();
    }
    return option.exitCode;
  }

  private registerExitSignal(signal: NodeJS.Signals, exitOption: ExitOption) {
    const handler = () => {
      this.logger.info('Receive signal %s, going to quit', signal);
      this.stop(exitOption);
      if (exitOption.forcedExitWhenRepeated) {
        const repeatedHandler = () => {
          this.logger.info('Receive signal %s again, force quit immediately', signal);
          const option = Object.assign({}, this.runOption.forcedExitOption, exitOption);
          this.forceStop(option);
        };
        this.signalHandler.set(signal, repeatedHandler);
        this.process.once(signal, repeatedHandler);
      }
    };
    this.signalHandler.set(signal, handler);
    this.process.once(signal, handler);
  }

  private setupEventListeners() {
    this.process.on('warning', this.onProcessWarning);
    this.process.on('unhandledRejection', this.onProcessError);
    this.process.on('uncaughtException', this.onProcessError);
    for (const [signal, exitOption] of Object.entries(this.runOption.exitSignals) as [NodeJS.Signals, ExitOption][]) {
      this.registerExitSignal(signal, Object.assign({}, this.runOption.normalExitOption, exitOption));
    }
  }

  private clearEventListeners() {
    this.process.removeListener('warning', this.onProcessWarning);
    this.process.removeListener('unhandledRejection', this.onProcessError);
    this.process.removeListener('uncaughtException', this.onProcessError);
    for (const [signal, handler] of this.signalHandler) {
      this.process.removeListener(signal, handler);
    }
  }
}

let entryPointCalled = false;

export function EntryPoint(runOption: Partial<RunOption> = {}) {

  return (moduleConstructor: Constructor) => {
    if (entryPointCalled) {
      throw new Error('only one entry point is allowed');
    }
    entryPointCalled = true;
    process.nextTick(() => ApplicationRunner.runModule(moduleConstructor, runOption));
  };
}
