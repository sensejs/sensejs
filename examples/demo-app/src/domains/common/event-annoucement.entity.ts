import {Entity, Column} from 'typeorm';
import {uuidV1} from '@sensejs/utility';

@Entity()
export class EventAnnouncement {

  @Column()
  readonly id: string = uuidV1();

  @Column()
  readonly timestamp: Date = new Date();

  @Column()
  readonly recordName: string;

  @Column()
  readonly recordId: string;

  @Column()
  readonly recordKey: string;

  @Column()
  announcedIndex = 0;

  constructor(recordName: string, recordId: string, recordKey: string) {
    this.recordName = recordName;
    this.recordId = recordId;
    this.recordKey = recordKey;
  }

}
