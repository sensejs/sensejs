import {AfterInsert, AfterUpdate, EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent} from 'typeorm';
import {User, UserEvent} from '../../domains/user';

@EventSubscriber()
export class UserDomainEventSubscriber implements EntitySubscriberInterface<User> {

  listenTo() {
    return User;
  }

  @AfterInsert()
  @AfterUpdate()
  async persistUserDomainEvent(event: InsertEvent<User> | UpdateEvent<User>) {
    const entityManager = event.manager;
    const userEventRepository = entityManager.getRepository(UserEvent);
    const user = event.entity;
    await userEventRepository.save(new UserEvent(user));
  }
}
