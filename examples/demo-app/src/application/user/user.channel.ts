import {createRxjsEventChannel} from '../../common/events/rxjs-events';
import {UserEvent} from '../../domains/user/user-event.entity';

const userEventChannel = createRxjsEventChannel<UserEvent>();

export const userEventChannelReceiver = userEventChannel.receiver;
