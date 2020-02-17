
export abstract class EventAnnounceService {
  static readonly map = new WeakMap<object, EventAnnounceService>();
  abstract announceRecordedEvent(recordName: string, recordKey: string): void;
}
