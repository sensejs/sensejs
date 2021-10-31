import {
  concat,
  defer,
  EMPTY,
  firstValueFrom,
  from,
  fromEvent,
  map,
  merge,
  Observable,
  of,
  Subject,
  Subscription,
} from 'rxjs';
import {catchError, first, mapTo, mergeMap, skip, tap, timeout} from 'rxjs/operators';
import {ModuleRoot} from './module-root.js';
import {consoleLogger, Logger} from './logger.js';
import {Constructor} from './interfaces.js';
import {ModuleClass} from './module.js';
import {ProcessManager} from './builtins.js';
import _ from 'lodash';
import {Container} from '@sensejs/container';
import {Inject} from './decorators.js';
import {invokeMethod} from './method-invoker.js';

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

export interface RunnerOption<T = never> {
  normalExitOption: NormalExitOption;
  forcedExitOption: ForcedExitOption;
  errorExitOption: ExitOption;
  exitSignals: ExitSignalOption;
  logger: Logger;
  printWarning: boolean;
  onExit: (exitCode: number) => T;
}

export const defaultRunOption: RunnerOption<any> = {
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
  static instance = new ApplicationRunner(process);
  private runSubscription?: Subscription;

  private stoppedSubject = new Subject<ExitOption>();
  private uncaughtErrorObservable = merge(
    fromEvent(this.process, 'uncaughtException'),
    fromEvent(this.process, 'unhandledRejection'),
  );

  protected constructor(private process: NodeJS.EventEmitter) {}

  run<M extends {}, K extends keyof M, T = never>(
    entryModule: Constructor<M>,
    entryMethodKey: K,
    runOption: Partial<RunnerOption<T>> = {},
  ) {
    this.performRunModule(entryModule, entryMethodKey, _.merge({}, defaultRunOption, runOption), false);
  }

  runModule<M extends {}, K extends keyof M, T = never>(
    ...args:
      | [entryModule: Constructor<M>, entryMethod: K, runOption: Partial<RunnerOption<T>>]
      | [entryModule: Constructor<M>, runOption: Partial<RunnerOption<T>>]
      | [entryModule: Constructor<M>, entryMethod: K]
      | [entryModule: Constructor<M>]
  ) {
    const entryModule = args[0];

    if (args.length === 1) {
      this.performRunModule(entryModule, undefined, defaultRunOption, true);
    } else if (typeof args[1] === 'object') {
      this.performRunModule(entryModule, undefined, _.merge({}, defaultRunOption, args[1]), true);
    } else {
      this.performRunModule(entryModule, args[1], _.merge({}, defaultRunOption, args[2]), true);
    }
  }

  private createProcessManager<T>(runOption: RunnerOption<T>) {
    return new ProcessManager((e?: Error) => {
      if (e) {
        runOption.logger.info('Requested to shutdown due to error occurred: ', e);
      }
      this.stoppedSubject.next(e ? runOption.errorExitOption : runOption.normalExitOption);
      this.stoppedSubject.complete();
    });
  }

  private performRunModule<M extends {}, K extends keyof M, T = never>(
    entryModule: Constructor<M>,
    entryMethodKey: K | undefined,
    runOption: RunnerOption<T>,
    startAllModules: boolean,
  ) {
    if (this.runSubscription) {
      throw new Error('run() or runModule() ApplicationRunner can only be executed once in a process');
    }
    const stoppedPromise = firstValueFrom(this.stoppedSubject);
    @ModuleClass({
      requires: [entryModule],
    })
    class RunnerWrapperModule {
      async main(@Inject(Container) container: Container) {
        if (entryMethodKey) {
          await invokeMethod(container.createResolveSession(), entryModule, entryMethodKey);
        }
        return stoppedPromise;
      }
    }

    const processManager = this.createProcessManager(runOption);
    const moduleRoot = new ModuleRoot(RunnerWrapperModule, processManager);
    const uncaughtErrorExitCodeObservable = this.uncaughtErrorObservable.pipe(
      first(),
      tap((e) => {
        runOption.logger.error('Going to quit due to uncaught error:', e);
      }),
      mapTo(runOption.errorExitOption),
    );

    const warningSubscriber = this.getWarningSubscriber(runOption);
    const exitSignalObservables = this.getExitSignalObservables(runOption);
    const exitSignalObservable = merge(...exitSignalObservables).pipe(first());
    const forcedExitSignalObservable = merge(
      ...exitSignalObservables.map((o) => {
        return o.pipe(skip(1));
      }),
    ).pipe(
      first(),
      map((x) => x.forcedExitCode ?? runOption.forcedExitOption.forcedExitCode),
    );

    const runningObservable = merge(
      uncaughtErrorExitCodeObservable,
      exitSignalObservable,
      concat(
        startAllModules
          ? this.getStartupObservable(moduleRoot, runOption)
          : this.getBoostrapObservable(moduleRoot, runOption),
        defer(async () => moduleRoot.run('main')).pipe(
          mapTo(runOption.normalExitOption),
          catchError((e) => {
            runOption.logger.error('Error occurred while running:', e);
            runOption.logger.error('Going to quit.');
            return of(runOption.errorExitOption);
          }),
        ),
      ),
    ).pipe(
      first(),
      tap(() => {}),
    );
    const shutdownObservable = this.getShutdownObservable(runningObservable, moduleRoot, runOption);

    this.runSubscription = merge(shutdownObservable, forcedExitSignalObservable)
      .pipe(
        first(),
        tap((exitCode) => {
          warningSubscriber.unsubscribe();
          return runOption.onExit(exitCode);
        }),
      )
      .subscribe();
  }

  private getExitSignalObservables<T>(runOption: RunnerOption<T>) {
    return Object.entries(runOption.exitSignals).map(([signal, partialExitOption]) => {
      const exitOption: ExitOption = Object.assign({}, runOption.normalExitOption, partialExitOption);
      return fromEvent(this.process, signal).pipe(
        first(),
        mergeMap(() => this.createForcedExitObservable(signal, exitOption, runOption)),
      );
    });
  }

  private runOnNextTick(fn: () => Promise<void>) {
    return new Observable<never>((subscriber) => {
      setImmediate(() => {
        fn().then(
          () => subscriber.complete(),
          (e) => subscriber.error(e),
        );
      });
    });
  }

  private getBoostrapObservable<M, T>(moduleRoot: ModuleRoot<M>, runOption: RunnerOption<T>): Observable<ExitOption> {
    return defer(() => this.runOnNextTick(() => moduleRoot.bootstrap())).pipe(
      catchError((e) => {
        runOption.logger.error('Error occurred while bootstrapping:', e);
        return of(runOption.errorExitOption);
      }),
    );
  }

  private getStartupObservable<M, T>(moduleRoot: ModuleRoot<M>, runOption: RunnerOption<T>): Observable<ExitOption> {
    return defer(() => this.runOnNextTick(() => moduleRoot.start())).pipe(
      mergeMap(() => EMPTY),
      catchError((e) => {
        runOption.logger.error('Error occurred while starting:', e);
        return of(runOption.errorExitOption);
      }),
    );
  }

  private performShutdown<M, T>(moduleRoot: ModuleRoot<M>, exitOption: ExitOption, runOption: RunnerOption<T>) {
    return merge(
      from(moduleRoot.shutdown()).pipe(
        mapTo(exitOption.exitCode),
        catchError((e) => {
          runOption.logger.error('Error occurred while shutdown:', e);
          return of(runOption.errorExitOption.exitCode);
        }),
        timeout(exitOption.timeout),
        catchError(() => of(runOption.forcedExitOption.forcedExitCode)),
      ),
    ).pipe(first());
  }

  private getShutdownObservable<M extends {}, T>(
    runningProcessObservable: Observable<ExitOption>,
    moduleRoot: ModuleRoot<M>,
    runOption: RunnerOption<T>,
  ) {
    return runningProcessObservable.pipe(
      first(),
      mergeMap((exitOption) => {
        return concat(this.performShutdown(moduleRoot, exitOption, runOption), of(exitOption.exitCode));
      }),
    );
  }

  private getWarningSubscriber<T>(runOption: RunnerOption<T>) {
    return fromEvent(this.process, 'warning').subscribe({
      next: (e) => {
        if (runOption.printWarning) {
          runOption.logger.warn('Warning: ', e);
        }
      },
    });
  }

  private createForcedExitObservable<T>(
    signal: string,
    exitOption: ExitOption,
    runOption: RunnerOption<T>,
  ): Observable<ExitOption> {
    runOption.logger.info('Receive signal %s, going to quit', signal);
    const result = of(exitOption);
    if (!exitOption.forcedExitWhenRepeated) {
      return result;
    }
    return concat(result, fromEvent(this.process as NodeJS.EventEmitter, signal).pipe(first(), mapTo(exitOption)));
  }
}
