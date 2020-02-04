import {UserEventRecorder} from '../domains/user';
import {EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent} from 'typeorm';
import {EventRecordMetadata, getEventRecordMetadata} from '../common/events/event-recording';

@EventSubscriber()
export class PersistRecordedEventSubscriber implements EntitySubscriberInterface<unknown> {

  async afterInsert(event: InsertEvent<unknown>) {
    return this.persistUserDomainEvent(event);
  }

  async afterUpdate(event: UpdateEvent<unknown>) {
    return this.persistUserDomainEvent(event);
  }

  private async persistUserDomainEvent(event: InsertEvent<unknown> | UpdateEvent<unknown>) {
    const metadata = getEventRecordMetadata(event.metadata.inheritanceTree[0]);
    if (typeof metadata !== 'undefined') {
      const {recorder} = metadata as EventRecordMetadata<unknown, unknown, unknown>;
      const eventRecords = recorder.getRecordedEvent(event.entity);
      if (eventRecords.length > 0) {
        const repository = event.manager.getRepository(UserEventRecorder.recordConstructor);
        await repository.save(eventRecords);
      }
    }
  }
}
