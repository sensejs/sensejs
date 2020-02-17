import {EventAnnounceService} from './event-announce.service';

export class TransactionEventAnnounceService extends EventAnnounceService {

  private readonly map: Map<string, Set<string>> = new Map();

  constructor(private parentEventAnnounceService: EventAnnounceService) {
    super();
  }

  announceRecordedEvent(recordName: string, recordKey: string) {
    let set = this.map.get(recordName);
    if (typeof set === 'undefined') {
      set = new Set();
      this.map.set(recordName, set);
    }
    set.add(recordKey);
  }

  commit() {
    this.map.forEach((set, name) => {
      set.forEach((key) => {
        this.parentEventAnnounceService.announceRecordedEvent(name, key);
      });
    });
  }

}
