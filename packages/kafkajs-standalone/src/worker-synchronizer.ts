import {firstValueFrom, from, Observable, Subject, Subscriber, Subscription, zip} from 'rxjs';

export class WorkerSynchronizer<T = void> {
  private subscription: Subscription;
  private cancellationSubscriber?: Subscriber<void>;
  private synchronizer: Promise<T>;

  constructor(
    private cancellationSubject: Subject<(observable: Observable<void>) => Observable<T>>,
    private defaultValue: T,
  ) {
    this.subscription = cancellationSubject.subscribe({
      next: (acknowledgeCallback: (cancellationObservable: Observable<void>) => Observable<T>) => {
        this.subscription.unsubscribe();
        this.synchronizer = firstValueFrom(
          acknowledgeCallback(
            new Observable<void>((subscriber) => {
              this.cancellationSubscriber = subscriber;
            }),
          ),
        );
      },
    });
    this.synchronizer = Promise.resolve(defaultValue);
  }

  async checkSynchronized(onSynchronized: () => Promise<void>): Promise<T | void> {
    if (this.cancellationSubscriber) {
      await onSynchronized();
      this.cancellationSubscriber.complete();
    }
    return this.synchronizer;
  }

  detach(): void {
    this.subscription.unsubscribe();
  }
}

export class WorkerController<T = void> {
  private subject = new Subject<(observable: Observable<void>) => Observable<T>>();

  private inFlightSynchronization?: Function;

  createSynchronizer(defaultValue: T): WorkerSynchronizer<T> {
    return new WorkerSynchronizer(this.subject, defaultValue);
  }

  synchronize(onSynchronize: () => Promise<T>): boolean {
    if (this.inFlightSynchronization) {
      return false;
    }
    this.inFlightSynchronization = onSynchronize;

    const allCancelSynchronized = new Subject<T>();
    allCancelSynchronized.subscribe({
      complete: () => {
        this.inFlightSynchronization = undefined;
      },
    });
    const allCancellationProcess: Observable<void>[] = [];
    const fn = (cancellationObserver: Observable<void>): Observable<T> => {
      allCancellationProcess.push(cancellationObserver);
      return allCancelSynchronized;
    };
    this.subject.next(fn);
    zip(...allCancellationProcess).subscribe({
      complete: () => {
        from(onSynchronize()).subscribe(allCancelSynchronized);
      },
    });
    return true;
  }
}
