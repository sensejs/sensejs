import {EntityManager, EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent} from 'typeorm';
import {getEventRecordingMetadata} from '../common/events/event-recording';
import {getAnnounceRecordedEventMetadata} from '../common/events/announce-recorded-event';
import {Constructor} from '@sensejs/utility';
import {EventAnnounceService} from '../infrastructure/event/event-announce.service';
import {EventAnnouncement} from '../domains/infrastructure/event-annoucement.entity';

@EventSubscriber()
export class PersistRecordedEventSubscriber implements EntitySubscriberInterface<unknown> {

  async afterInsert(event: InsertEvent<unknown>) {
    return this.persistRecordedEvent(event);
  }

  async afterUpdate(event: UpdateEvent<unknown>) {
    return this.persistRecordedEvent(event);
  }

  private async persistRecordedEvent(event: InsertEvent<unknown> | UpdateEvent<unknown>) {
    const eventRecordingMetadata = getEventRecordingMetadata(event.metadata.inheritanceTree[0]);
    const entityManager = event.manager;
    if (typeof eventRecordingMetadata !== 'undefined') {
      const {recorder} = eventRecordingMetadata;
      const recordConstructor = recorder.recordConstructor;
      const eventRecord = recorder.createEventRecord(event.entity as {});
      if (typeof eventRecord !== 'undefined') {
        const repository = entityManager.getRepository<{}>(recordConstructor);
        await repository.save(eventRecord);
        await this.announceRecordedEvent(recordConstructor, eventRecord, entityManager);
      }
    }
  }

  private async announceRecordedEvent(
    recordConstructor: Constructor,
    eventRecord: {},
    entityManager: EntityManager,
  ) {
    const announceRecordedEventMetadata = getAnnounceRecordedEventMetadata(recordConstructor);
    if (announceRecordedEventMetadata) {
      const {announcer} = announceRecordedEventMetadata;
      const eventRecordEntityMetadata = entityManager.connection.getMetadata(recordConstructor);
      const announcement = announcer(eventRecord, eventRecordEntityMetadata);
      const announcementRepository = entityManager.getRepository(EventAnnouncement);
      await announcementRepository.save(announcement);
      const eventAnnouncerService = EventAnnounceService.map.get(entityManager);
      if (typeof eventAnnouncerService !== 'undefined') {
        eventAnnouncerService.announceRecordedEvent(eventRecordEntityMetadata.name, announcement.recordKey);
      }
    }
  }
}
