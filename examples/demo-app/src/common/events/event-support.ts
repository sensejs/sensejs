import {Component, ComponentScope, Constructor, Inject} from '@sensejs/core';
import {BatchedEventAnnouncer, EventChannel, EventAnnouncer} from './types';
import {createRxjsEventChannel} from './rxjs-events';

export abstract class EventBroadcaster {

  abstract getAnnouncerOf<Record>(recordConstructor: Constructor<Record>): EventAnnouncer<Record>;

}

@Component({scope: ComponentScope.SINGLETON})
export class ChannelBus {

  readonly channels: Map<Constructor, EventChannel<unknown>> = new Map();

  channel<Record>(recordConstructor: Constructor<Record>) {
    let channel = this.channels.get(recordConstructor);
    if (typeof channel === 'undefined') {
      channel = createRxjsEventChannel<Record>();
      this.channels.set(recordConstructor, channel);
    }
    return channel;
  }
}

@Component({id: EventBroadcaster, scope: ComponentScope.SINGLETON})
export class GlobalEventBroadcaster extends EventBroadcaster {

  constructor(@Inject(ChannelBus) private channelBus: ChannelBus) {
    super();
  }

  getAnnouncerOf<Record>(recordConstructor: Constructor<Record>): EventAnnouncer<Record> {
    return this.channelBus.channel(recordConstructor).announcer;
  }
}

@Component({scope: ComponentScope.TRANSIENT})
export class TransactionEventBroadcaster extends EventBroadcaster {

  static weakMap = new WeakMap<object, TransactionEventBroadcaster>();

  readonly announcers: Map<Constructor, BatchedEventAnnouncer<any>> = new Map();

  constructor(@Inject(EventBroadcaster) private eventBus: EventBroadcaster) {
    super();
  }

  getAnnouncerOf<Record>(recordConstructor: Constructor<Record>): EventAnnouncer<Record> {
    let transmitter = this.announcers.get(recordConstructor);
    if (typeof transmitter === 'undefined') {
      transmitter = new BatchedEventAnnouncer(this.eventBus.getAnnouncerOf(recordConstructor));
      this.announcers.set(recordConstructor, transmitter);
    }
    return transmitter;
  }

  async commit(postCommit: <Record>(
    constructor: Constructor<Record>,
    record: Record[],
  ) => Promise<void> = () => Promise.resolve()) {
    return Promise.all(Array.from(this.announcers.values()).map((transmitter) => transmitter.flush()));
  }
}
