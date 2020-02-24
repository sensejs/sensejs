import {
  EventSubscription,
  EventSubscriptionContext,
  EventSubscriptionModule,
} from '../../domains/common/event-subscription';
import {UserEvent} from '../../domains/user/user-event.entity';
import {Inject, InjectLogger, Logger, OnModuleCreate} from '@sensejs/core';
import {TransactionalEventAnnounceInterceptor} from '../common/transactional-event-announce.interceptor';

@EventSubscriptionModule({
  interceptors: [TransactionalEventAnnounceInterceptor]
})
export class NotificationModule {

  constructor(@InjectLogger() private logger: Logger) {

  }

  @OnModuleCreate()
  async onModuleCreate() {
    this.logger.info('Notification set up');

  }

  @EventSubscription(UserEvent)
  async onUserEvent(@Inject(EventSubscriptionContext) context: EventSubscriptionContext<UserEvent>) {
    this.logger.info('Received user event message: ', context.payload);
  }
}
