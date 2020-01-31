import {createRxjsEventChannel} from '../../common/events/rxjs-events';
import {UserEvent} from '../../domains/user';

const userEventChannel = createRxjsEventChannel<UserEvent>();

export const userEventChannelReceiver = userEventChannel.receiver;
