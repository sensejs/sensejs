import {EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent} from 'typeorm';
import {EventRecordingMetadata, getEventRecordingMetadata} from '../common/events/event-recording';
import {EventRecordPersistenceService} from '../common/events/event-record-persist.service';
import {TransactionEventBroadcaster} from '../common/events/event-support';

@EventSubscriber()
export class PersistRecordedEventSubscriber implements EntitySubscriberInterface<unknown> {

  async afterInsert(event: InsertEvent<unknown>) {
    return this.persistUserDomainEvent(event);
  }

  async afterUpdate(event: UpdateEvent<unknown>) {
    return this.persistUserDomainEvent(event);
  }

  private async persistUserDomainEvent(event: InsertEvent<unknown> | UpdateEvent<unknown>) {
    const metadata = getEventRecordingMetadata(event.metadata.inheritanceTree[0]);
    const entityManager = event.manager;
    if (typeof metadata !== 'undefined') {
      const {recorder} = metadata as EventRecordingMetadata<unknown, unknown, unknown>;
      const eventRecords = recorder.getRecordedEvent(event.entity);
      if (eventRecords.length > 0) {
        const repository = event.manager.getRepository(recorder.recordConstructor);
        await repository.save(eventRecords);
        const eventBus = TransactionEventBroadcaster.contextMap.get(entityManager);
        eventBus?.getAnnouncerOf(recorder.recordConstructor)?.announce(...eventRecords);
      }
    }
  }
}
