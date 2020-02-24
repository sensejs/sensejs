import {User} from './user.entity';
import {Column, Entity, ManyToOne, PrimaryGeneratedColumn} from 'typeorm';
import {uuidV1} from '@sensejs/utility';
import {EventAnnouncement} from '../common/event-annoucement.entity';
import {AnnounceRecordedEvent} from '../common/announce-recorded-event';

export enum UserEventType {
  CREATED = 'CREATED',
  NAME_CHANGED = 'NAME_CHANGED',
  EMAIL_CHANGED = 'EMAIL_CHANGED',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED'
}

export interface UserEmailChangedEvent {
  type: UserEventType.EMAIL_CHANGED;
  userId: string;
  index: number;
  originEmailAddress?: string;
  currentEmailAddress?: string;
}

export interface UserEmailVerifiedEvent {
  type: UserEventType.EMAIL_VERIFIED;
  userId: string;
  index: number;
  emailAddress: string;
}

export interface UserPasswordChangedEvent {
  type: UserEventType.PASSWORD_CHANGED;
  userId: string;
  index: number;
}

export interface UserCreatedEvent {
  type: UserEventType.CREATED;
  userId: string;
  index: number;
  name: string;
}

export interface UserNameChangedEvent {
  type: UserEventType.NAME_CHANGED;
  userId: string;
  index: number;
  originName: string;
  currentName: string;
}

export type UserEventPayload = UserCreatedEvent
  | UserNameChangedEvent
  | UserEmailChangedEvent
  | UserEmailVerifiedEvent
  | UserPasswordChangedEvent;

@Entity()
@AnnounceRecordedEvent(
  (userEvent: UserEvent, metadata) => new EventAnnouncement(metadata.name, userEvent.id, userEvent.user.id),
  (userEvent) => userEvent.payloads,
)
export class UserEvent {

  @PrimaryGeneratedColumn('uuid')
  readonly id = uuidV1();

  @Column()
  readonly timestamp: Date = new Date();

  @ManyToOne(() => User)
  readonly user: User;

  @Column({
    transformer: {
      to: (value) => JSON.stringify(value),
      from: (json) => JSON.parse(json)
    },
    type: 'json',
  })
  readonly payloads: UserEventPayload[];

  constructor(user: User, payloads: UserEventPayload[]) {
    this.user = user;
    this.payloads = payloads;
  }
}
