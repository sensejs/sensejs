import {EventChannel} from './types';
import {createRxjsEventChannel} from './rxjs-events';

const channels: Map<unknown, EventChannel<unknown>> = new Map();

export function ensureEventChannel(target: unknown) {

  let channel = channels.get(target);
  if (typeof channel === 'undefined') {
    channel = createRxjsEventChannel();
    channels.set(target, channel);
  }
  return channel;
}
