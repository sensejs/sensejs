import {ModuleRoot} from './module-root';
import {consoleLogger, Logger} from './logger';
import {Constructor} from './interfaces';
import {concat, from, fromEvent, merge, Observable, of, Subject} from 'rxjs';
import {ModuleClass} from './module';
import {catchError, first, mapTo, mergeMap, skip, timeout} from 'rxjs/operators';
import {ProcessManager} from './builtins';

interface NormalExitOption {
  exitCode: number;
  timeout: number;
}

interface ForcedExitOption {
  forcedExitCode: number;
  forcedExitWhenRepeated: boolean;
}

interface ExitOption extends NormalExitOption, Partial<ForcedExitOption> {}

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

interface EntryPointModule {
  main(): Promise<ExitOption>;
}

export class ApplicationRunner {
  private runPromise?: Promise<void>;
  private logger: Logger = this.runOption.logger;

  private stoppedSubject = new Subject<ExitOption>();
  private processManager = new ProcessManager((e?: Error) => {
    if (e) {
      this.logger.info('Requested to shutdown due to error occurred: ', e);
    }
    this.stoppedSubject.next(e ? this.runOption.errorExitOption : this.runOption.normalExitOption);
    this.stoppedSubject.complete();
  });

  private exitSignalObservables = Object.entries(this.runOption.exitSignals).map(([signal, partialExitOption]) => {
    const exitOption: ExitOption = Object.assign({}, this.runOption.normalExitOption, partialExitOption);
    return fromEvent(this.process, signal, {once: true}).pipe(
      mergeMap(() => this.createForcedExitObservable(signal, exitOption)),
    );
  });

  private exitSignalObservable = merge(...this.exitSignalObservables.map((o) => o.pipe(first()))).pipe(first());

  private forcedExitSignalObservable = merge(...this.exitSignalObservables.map((o) => o.pipe(skip(1)))).pipe(
    first(),
    mapTo(this.runOption.forcedExitOption.forcedExitCode),
  );

  private uncaughtErrorObservable = merge(
    fromEvent(this.process, 'uncaughtException'),
    fromEvent(this.process, 'unhandledRejection'),
  );

  constructor(
    private process: NodeJS.EventEmitter,
    private module: Constructor,
    private runOption: RunOption<unknown>,
  ) {}

  static async runModule<T>(entryModule: Constructor, runOption: Partial<RunOption<T>> = {}): Promise<void> {
    const actualRunOption = Object.assign({}, defaultRunOption, runOption);
    const runner = new ApplicationRunner(process, entryModule, actualRunOption);
    await runner.run();
  }

  shutdown(): void {
    this.stoppedSubject.next(this.runOption.normalExitOption);
    this.stoppedSubject.complete();
  }

  async run(): Promise<void> {
    if (this.runPromise) {
      return this.runPromise;
    }
    this.runPromise = this.performRun();
    return this.runPromise;
  }

  private getStartupObservable(moduleRoot: ModuleRoot<EntryPointModule>): Observable<ExitOption> {
    return merge(
      from(moduleRoot.start()).pipe(
        mergeMap(() => of<ExitOption>()),
        catchError((e) => {
          this.logger.error('Error occurred while starting up:', e);
          return of(this.runOption.errorExitOption);
        }),
      ),
    );
  }

  private performStop<T>(moduleRoot: ModuleRoot<T>, exitOption: ExitOption, ueo: Observable<number>) {
    return merge(
      from(moduleRoot.stop()).pipe(
        mapTo(exitOption.exitCode),
        catchError((e) => {
          this.logger.error('Error occurred while shutting down:', e);
          return of(this.runOption.errorExitOption.exitCode);
        }),
        timeout(exitOption.timeout),
        catchError(() => of(this.runOption.forcedExitOption.forcedExitCode)),
      ),
      ueo,
    ).pipe(first());
  }

  private createApplicationRunnerModule(): Constructor<EntryPointModule> {
    const stoppedPromise = this.stoppedSubject.toPromise();

    @ModuleClass({
      requires: [this.module],
    })
    class ApplicationRunnerModule implements EntryPointModule {
      main() {
        return stoppedPromise;
      }
    }

    return ApplicationRunnerModule;
  }

  private async performRun() {
    const moduleRoot = new ModuleRoot(this.createApplicationRunnerModule(), this.processManager);
    const uncaughtErrorExitCodeObservable = this.uncaughtErrorObservable.pipe(
      mapTo(this.runOption.errorExitOption.exitCode),
    );

    const warningSubscriber = this.getWarningSubscriber();
    const uncaughtErrorSubscriber = this.getUncaughtErrorSubscriber(this.uncaughtErrorObservable);
    const shutdownSignalSubscriber = this.getShutdownSignalSubscriber(this.exitSignalObservable);

    const startupObservable = this.getStartupObservable(moduleRoot);
    const runningObservable = this.getRunningObservable(startupObservable, moduleRoot);
    const shutdownObservable = this.getShutdownSubscriber(
      runningObservable,
      moduleRoot,
      uncaughtErrorExitCodeObservable,
    );

    try {
      const exitCode = await merge(shutdownObservable, this.forcedExitSignalObservable).pipe(first()).toPromise();
      this.runOption.onExit(exitCode);
    } finally {
      uncaughtErrorSubscriber.unsubscribe();
      shutdownSignalSubscriber.unsubscribe();
      warningSubscriber.unsubscribe();
    }
  }

  private getShutdownSubscriber(
    runningProcessObservable: Observable<ExitOption>,
    moduleRoot: ModuleRoot<EntryPointModule>,
    uncaughtErrorObserver: Observable<number>,
  ) {
    return runningProcessObservable.pipe(
      first(),
      mergeMap((exitOption) => {
        return this.performStop(moduleRoot, exitOption, uncaughtErrorObserver);
      }),
    );
  }

  private getRunningObservable(
    startupProcessObservable: Observable<ExitOption>,
    moduleRoot: ModuleRoot<EntryPointModule>,
  ) {
    return concat(
      startupProcessObservable,
      new Observable<ExitOption>((subscriber) =>
        merge(
          of(moduleRoot.run('main')).pipe(
            catchError((e) => {
              this.logger.error('Error occurred while running:', e);
              this.logger.error('Going to quit.');
              return of(this.runOption.errorExitOption);
            }),
          ),
        ).subscribe(subscriber),
      ),
    );
  }

  private getShutdownSignalSubscriber(exitSignalObservable: Observable<ExitOption>) {
    return exitSignalObservable.subscribe({
      next: (exitOption) => {
        this.stoppedSubject.next(exitOption);
        this.stoppedSubject.complete();
      },
    });
  }

  private getUncaughtErrorSubscriber(uncaughtErrorObserver: Observable<unknown>) {
    return uncaughtErrorObserver.subscribe({
      next: (e) => {
        this.logger.error('Going to quit due to uncaught error:', e);
        this.stoppedSubject.next(this.runOption.errorExitOption);
        this.stoppedSubject.complete();
      },
    });
  }

  private getWarningSubscriber() {
    return fromEvent(this.process, 'warning').subscribe({
      next: (e) => {
        if (this.runOption.printWarning) {
          this.logger.warn('Warning: ', e);
        }
      },
    });
  }

  private createForcedExitObservable(signal: string, exitOption: ExitOption): Observable<ExitOption> {
    this.logger.info('Receive signal %s, going to quit', signal);
    const result = of(exitOption);
    if (!exitOption.forcedExitWhenRepeated) {
      return result;
    }
    return concat(result, fromEvent(this.process as NodeJS.EventEmitter, signal, {once: true}).pipe(mapTo(exitOption)));
  }
}

let entryPointCalled = false;

export function EntryPoint(runOption: Partial<RunOption> = {}) {
  return (moduleConstructor: Constructor): void => {
    if (entryPointCalled) {
      throw new Error('only one entry point is allowed');
    }
    entryPointCalled = true;
    process.nextTick(() =>
      ApplicationRunner.runModule(
        moduleConstructor,
        Object.assign({}, defaultRunOption, {onExit: (exitCode: number) => process.exit(exitCode)}, runOption),
      ),
    );
  };
}
