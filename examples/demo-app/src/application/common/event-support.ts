import {Component, ComponentScope, Constructor, Inject} from '@sensejs/core';
import {EventAnnouncer, EventChannel} from './types';
import {createRxjsEventChannel} from './rxjs-events';

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

@Component({scope: ComponentScope.SINGLETON})
export class EventBroadcaster {

  constructor(@Inject(ChannelBus) private channelBus: ChannelBus) {
  }

  getAnnouncerOf<Record>(recordConstructor: Constructor<Record>): EventAnnouncer<Record> {
    return this.channelBus.channel(recordConstructor).announcer;
  }
}
