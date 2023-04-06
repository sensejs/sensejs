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
import {EntryModule} from './entry-module.js';
import {consoleLogger, Logger} from './logger.js';
import {Constructor} from './interfaces.js';
import {Module, ModuleMetadataLoader} from './module.js';
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

export class ApplicationRunner {
  static instance = new ApplicationRunner(process);
  private runSubscription?: Subscription;

  private stoppedSubject = new Subject<ExitOption>();
  private uncaughtErrorObservable = merge(
    fromEvent(this.process, 'uncaughtException'),
    fromEvent(this.process, 'unhandledRejection'),
  );

  protected constructor(private process: NodeJS.EventEmitter, private moduleLoader = new ModuleMetadataLoader()) {}

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
    entryModuleConstructor: Constructor<M>,
    entryMethodKey: K | undefined,
    runOption: RunnerOption<T>,
    startAllModules: boolean,
  ) {
    if (this.runSubscription) {
      throw new Error('run() or runModule() ApplicationRunner can only be executed once in a process');
    }
    const stoppedPromise = firstValueFrom(this.stoppedSubject);
    @Module({
      requires: [entryModuleConstructor],
    })
    class RunnerWrapperModule {
      async main(@Inject(Container) container: Container) {
        if (entryMethodKey) {
          await invokeMethod(container.createResolveSession(), entryModuleConstructor, entryMethodKey);
        }
        return stoppedPromise;
      }
    }

    const processManager = this.createProcessManager(runOption);
    const entryModule = new EntryModule(RunnerWrapperModule, processManager, this.moduleLoader);
    const uncaughtErrorExitCodeObservable = this.uncaughtErrorObservable.pipe(
      first(),
      tap((e) => {
        runOption.logger.error('Going to quit due to uncaught error:', e);
      }),
      mapTo(runOption.errorExitOption),
    );

    const warningSubscriber = this.getWarningSubscriber(runOption);
    const exitSignalObservables = this.getExitSignalObservables(runOption);
    const exitSignalObservable = merge(...exitSignalObservables).pipe(
      first(),
      tap((signal) => {
        runOption.logger.info('Receive signal %s, going to quit', signal);
      }),
      map((signal) => Object.assign({}, runOption.normalExitOption, runOption.exitSignals[signal])),
    );
    const forcedExitSignalObservable = merge(
      ...exitSignalObservables.map((o) => {
        return o.pipe(skip(1));
      }),
    ).pipe(
      first(),
      map((signal) => runOption.exitSignals[signal]?.forcedExitCode ?? runOption.forcedExitOption.forcedExitCode),
    );

    const runningObservable = merge<NormalExitOption[]>(
      uncaughtErrorExitCodeObservable,
      exitSignalObservable,
      concat(
        startAllModules
          ? this.getStartupObservable(entryModule, runOption)
          : this.getBoostrapObservable(entryModule, runOption),
        defer(async () => entryModule.run('main')).pipe(
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
    const shutdownObservable = this.getShutdownObservable(runningObservable, entryModule, runOption);

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

  private getExitSignalObservables<T>(runOption: RunnerOption<T>): Observable<NodeJS.Signals>[] {
    return Object.entries(runOption.exitSignals).map(([signal]) => {
      return fromEvent(this.process, signal).pipe(mapTo(signal as NodeJS.Signals));
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

  private getBoostrapObservable<M extends {}, T>(
    moduleRoot: EntryModule<M>,
    runOption: RunnerOption<T>,
  ): Observable<ExitOption> {
    return defer(() => this.runOnNextTick(() => moduleRoot.bootstrap())).pipe(
      catchError((e) => {
        runOption.logger.error('Error occurred while bootstrapping:', e);
        return of(runOption.errorExitOption);
      }),
    );
  }

  private getStartupObservable<M extends {}, T>(
    moduleRoot: EntryModule<M>,
    runOption: RunnerOption<T>,
  ): Observable<ExitOption> {
    return defer(() => this.runOnNextTick(() => moduleRoot.start())).pipe(
      mergeMap(() => EMPTY),
      catchError((e) => {
        runOption.logger.error('Error occurred while starting:', e);
        return of(runOption.errorExitOption);
      }),
    );
  }

  private performShutdown<M extends {}, T>(
    moduleRoot: EntryModule<M>,
    exitOption: ExitOption,
    runOption: RunnerOption<T>,
  ) {
    return merge(
      from(moduleRoot.shutdown()).pipe(
        map(() => exitOption.exitCode),
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
    moduleRoot: EntryModule<M>,
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
}
