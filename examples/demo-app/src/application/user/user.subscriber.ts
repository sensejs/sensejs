import {EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent} from 'typeorm';
import {User, UserEventRecorder} from '../../domains/user';

@EventSubscriber()
export class UserDomainEventSubscriber implements EntitySubscriberInterface<User> {

  listenTo() {
    return User;
  }

  async afterInsert(event: InsertEvent<User>) {
    return this.persistUserDomainEvent(event);
  }

  async afterUpdate(event: InsertEvent<User>) {
    return this.persistUserDomainEvent(event);
  }

  private async persistUserDomainEvent(event: InsertEvent<User> | UpdateEvent<User>) {
    const eventRecords = UserEventRecorder.getRecordedEvent(event.entity);
    if (eventRecords.length > 0) {
      const repository = event.manager.getRepository(UserEventRecorder.recordConstructor);
      await repository.save(eventRecords);
    }
  }
}
