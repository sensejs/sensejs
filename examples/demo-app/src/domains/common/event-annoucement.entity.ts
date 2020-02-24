import {Entity, PrimaryColumn, Column} from 'typeorm';
import {uuidV1} from '@sensejs/utility';

@Entity()
export class EventAnnouncement {

  @PrimaryColumn()
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
  announcedIndex: number = 0;

  constructor(recordName: string, recordId: string, recordKey: string) {
    this.recordName = recordName;
    this.recordId = recordId;
    this.recordKey = recordKey;
  }

}
