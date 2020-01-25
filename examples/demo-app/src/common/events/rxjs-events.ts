import {EventChannel, EventListener, EventReceiver, EventTransmitter} from './types';
import {Subject, Subscription} from 'rxjs';

/**
 * Internally receiver will receive
 */
interface EventBroadcast<T> {
  payloads: T[];
  acknowledge: (processPromise: Promise<void>) => void;
}

class RxjsEventListener implements EventListener {
  constructor(private subscription: Subscription) {
  }

  close() {
    return this.subscription.unsubscribe();
  }
}

class RxjsEventReceiver<T> implements EventReceiver<T> {
  constructor(private subject: Subject<EventBroadcast<T>>) {
  }

  listen(callback: (...payloads: T[]) => Promise<void>): EventListener {
    return new RxjsEventListener(this.subject.subscribe({
      next: (payloads: EventBroadcast<T>) => {
        payloads.acknowledge(callback(...payloads.payloads));
      },
    }));
  }

}

class RxjsEventTransmitter<T> implements EventTransmitter<T> {
  constructor(private subject: Subject<EventBroadcast<T>>) {
  }

  async transmit(...payloads: T[]) {
    const consumePromises: Promise<void>[] = [];
    this.subject.next({
      payloads,
      acknowledge: (p: Promise<void>) => consumePromises.push(p),
    });
    await Promise.all(consumePromises);
  }
}

class RxjsEventChannel<T> extends EventChannel<T> {

  readonly symbol = Symbol();
  private readonly subject = new Subject<EventBroadcast<T>>();
  readonly receiver = new RxjsEventReceiver<T>(this.subject);
  readonly transmitter = new RxjsEventTransmitter<T>(this.subject);

}

export function createRxjsEventChannel<T>(): EventChannel<T> {
  return new RxjsEventChannel<T>();
}
