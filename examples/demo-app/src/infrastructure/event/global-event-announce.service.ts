import {EntityManager, Repository} from 'typeorm';
import {BackgroundTaskQueue, Component, ComponentScope, Constructor, Inject, InjectLogger, Logger} from '@sensejs/core';
import {EventAnnouncement} from '../../domains/infrastructure/event-annoucement.entity';
import {EventBroadcaster} from '../../common/events/event-support';
import {EventAnnounceService} from './event-announce.service';
import {
  AnnounceRecordedEventMetadata,
  getAnnounceRecordedEventMetadata,
} from '../../domains/infrastructure/announce-recorded-event';

@Component({scope: ComponentScope.SINGLETON, id: EventAnnounceService})
export class GlobalEventAnnounceService extends EventAnnounceService {
  constructor(
    @Inject(EntityManager) private entityManager: EntityManager,
    @Inject(BackgroundTaskQueue) private backgroundTaskQueue: BackgroundTaskQueue,
    @Inject(EventBroadcaster) private eventBroadcaster: EventBroadcaster,
    @InjectLogger() private logger: Logger,
  ) {
    super();
  }

  announceRecordedEvent(recordName: string, recordKey: string) {

    this.backgroundTaskQueue.dispatch(
      this.entityManager.transaction(async (entityManager) => {
        const announcementRepository = entityManager.getRepository(EventAnnouncement);
        const recordMetadata = entityManager.connection.getMetadata(recordName);
        const recordConstructor = recordMetadata.inheritanceTree[0] as Constructor;
        const announceMetadata = getAnnounceRecordedEventMetadata(recordConstructor);
        if (typeof announceMetadata === 'undefined') {
          return;
        }
        const recordRepository = entityManager.getRepository(recordConstructor);
        const announcements = await announcementRepository.find({
          where: {recordName, recordKey},
          lock: {mode: 'pessimistic_write'},
        });

        for (const announcement of announcements) {
          await this.announceEvent(
            announceMetadata,
            recordRepository,
            announcement,
            recordConstructor,
            announcementRepository,
          );
        }
      }),
    );
  }

  private async announceEvent(
    announceMetadata: AnnounceRecordedEventMetadata,
    recordRepository: Repository<{}>,
    announcement: EventAnnouncement,
    recordConstructor: Constructor<{}>,
    announcementRepository: Repository<{}>,
  ) {
    const {events: getEvents} = announceMetadata;
    const record = await recordRepository.findOneOrFail(announcement.recordId);
    const events = getEvents(record);
    const announcer = this.eventBroadcaster.getAnnouncerOf(recordConstructor);
    try {
      while (announcement.announcedIndex < events.length) {
        const event = events[announcement.announcedIndex];
        await announcer.announce(event);
        announcement.announcedIndex++;
      }
    } catch (e) {
      this.logger.error(
        'Error occurred when announcing event, announcement: %s, idx: %d',
        announcement.id,
        announcement.announcedIndex,
      );
      this.logger.debug('Error detail: \n', e);
      this.logger.debug('Message payload: \n', events[announcement.announcedIndex]);
      await announcementRepository.save(announcement);
      throw e;
    }
    await announcementRepository.delete(announcement.id);
  }
}
