import {concat, defer, firstValueFrom, from, fromEvent, merge, Observable, of, Subject, Subscription} from 'rxjs';
import {catchError, first, mapTo, mergeMap, skip, tap, timeout} from 'rxjs/operators';
import {ModuleRoot} from './module-root.js';
import {consoleLogger, Logger} from './logger.js';
import {Constructor} from './interfaces.js';
import {ModuleClass} from './module.js';
import {ProcessManager} from './builtins.js';

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

export class ApplicationRunner<M> {
  private runSubscription?: Subscription;
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
    return fromEvent(this.process, signal).pipe(
      first(),
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
    private module: Constructor<M>,
    private runOption: RunOption<unknown>,
  ) {}

  static runModule<T>(entryModule: Constructor, runOption: Partial<RunOption<T>> = {}) {
    const actualRunOption = Object.assign({}, defaultRunOption, runOption);
    const runner = new ApplicationRunner(process, entryModule, actualRunOption);
    runner.run();
  }

  shutdown(): void {
    this.stoppedSubject.next(this.runOption.normalExitOption);
    this.stoppedSubject.complete();
  }

  run() {
    if (this.runSubscription) {
      return;
    }
    this.runSubscription = this.performRun().subscribe();
    return;
  }

  private getBoostrapObservable(moduleRoot: ModuleRoot<EntryPointModule>): Observable<ExitOption> {
    return merge(
      from(moduleRoot.bootstrap()).pipe(
        mergeMap(() => of<ExitOption>()),
        catchError((e) => {
          this.logger.error('Error occurred while bootstrapping:', e);
          return of(this.runOption.errorExitOption);
        }),
      ),
    );
  }

  private getStartupObservable(moduleRoot: ModuleRoot<EntryPointModule>): Observable<ExitOption> {
    return defer(() => moduleRoot.start()).pipe(
      mergeMap(() => {
        return of<ExitOption>();
      }),
      catchError((e) => {
        this.logger.error('Error occurred while starting:', e);
        return of(this.runOption.errorExitOption);
      }),
    );
  }

  private performStop<T>(moduleRoot: ModuleRoot<T>, exitOption: ExitOption, ueo: Observable<number>) {
    return merge(
      from(moduleRoot.shutdown()).pipe(
        mapTo(exitOption.exitCode),
        catchError((e) => {
          this.logger.error('Error occurred while stopping:', e);
          return of(this.runOption.errorExitOption.exitCode);
        }),
        timeout(exitOption.timeout),
        catchError(() => of(this.runOption.forcedExitOption.forcedExitCode)),
      ),
      ueo,
    ).pipe(first());
  }

  private performShutdown<T>(moduleRoot: ModuleRoot<T>, exitOption: ExitOption, ueo: Observable<number>) {
    return merge(
      from(moduleRoot.shutdown()).pipe(
        mapTo(exitOption.exitCode),
        catchError((e) => {
          this.logger.error('Error occurred while shutdown:', e);
          return of(this.runOption.errorExitOption.exitCode);
        }),
        timeout(exitOption.timeout),
        catchError(() => of(this.runOption.forcedExitOption.forcedExitCode)),
      ),
      ueo,
    ).pipe(first());
  }

  private createApplicationRunnerModule(): Constructor<EntryPointModule> {
    const stoppedPromise = firstValueFrom(this.stoppedSubject);

    @ModuleClass({
      requires: [this.module],
    })
    class ApplicationRunnerModule implements EntryPointModule {
      async main() {
        return stoppedPromise;
      }
    }

    return ApplicationRunnerModule;
  }

  private performRun(): Observable<number> {
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

    return merge(shutdownObservable, this.forcedExitSignalObservable).pipe(
      first(),
      tap((exitCode) => {
        uncaughtErrorSubscriber.unsubscribe();
        shutdownSignalSubscriber.unsubscribe();
        warningSubscriber.unsubscribe();
        this.runOption.onExit(exitCode);
      }),
    );
  }

  private getShutdownSubscriber(
    runningProcessObservable: Observable<ExitOption>,
    moduleRoot: ModuleRoot<EntryPointModule>,
    uncaughtErrorObserver: Observable<number>,
  ) {
    return runningProcessObservable.pipe(
      first(),
      mergeMap((exitOption) => {
        return this.performShutdown(moduleRoot, exitOption, uncaughtErrorObserver);
      }),
    );
  }

  private getRunningObservable(
    startupProcessObservable: Observable<ExitOption>,
    moduleRoot: ModuleRoot<EntryPointModule>,
  ) {
    return concat(
      startupProcessObservable,
      defer(async () => moduleRoot.run('main')).pipe(
        catchError((e) => {
          this.logger.error('Error occurred while running:', e);
          this.logger.error('Going to quit.');
          return of(this.runOption.errorExitOption);
        }),
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
    return concat(result, fromEvent(this.process as NodeJS.EventEmitter, signal).pipe(first(), mapTo(exitOption)));
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
