import {Constructor, DecoratorBuilder} from '@sensejs/utility';
import {Class} from '@sensejs/core';
import {EntityMetadata} from 'typeorm';
import {EventAnnouncement} from './/event-annoucement.entity';

export interface AnnounceRecordedEventMetadata<Record extends {} = {}> {
  announcer: (record: Record, recordEntityMetadata: EntityMetadata) => EventAnnouncement;
  events: (record: Record) => {}[];
}

const ANNOUNCE_RECORDED_EVENT_METADATA_KEY = Symbol();

export function AnnounceRecordedEvent<Record>(
  announcer: (record: Record, recordEntityMetadata: EntityMetadata) => EventAnnouncement,
  events: (record: Record) => {}[]
) {
  return new DecoratorBuilder(AnnounceRecordedEvent.name)
    .whenApplyToConstructor((constructor: Class) => {
      const metadata: AnnounceRecordedEventMetadata<Record> = {
        announcer,
        events
      };
      Reflect.defineMetadata(ANNOUNCE_RECORDED_EVENT_METADATA_KEY, constructor, metadata);
    })
    .build<(constructor: Constructor<Record>) => void>();
}

export function getAnnounceRecordedEventMetadata<Announcement extends {} = {}, Record extends {} = {}>(
  constructor: object,
): AnnounceRecordedEventMetadata<Record> | undefined {
  return Reflect.getMetadata(ANNOUNCE_RECORDED_EVENT_METADATA_KEY, constructor);
}
