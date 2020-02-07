import {User} from './user.entity';
import {Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique, VersionColumn} from 'typeorm';
import {uuidV1} from '@sensejs/utility';
import {EventRecorder} from '../../common/events/event-recorder';

export enum UserEventType {
  CREATED = 'CREATED',
  NAME_CHANGED = 'NAME_CHANGED',
  EMAIL_CHANGED = 'EMAIL_CHANGED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED'
}
export interface UserEmailChangedEvent {
  type: UserEventType.EMAIL_CHANGED;
  userId: string;
  originEmailAddress?: string;
  currentEmailAddress?: string;
}

export interface UserPasswordChangedEvent {
  type: UserEventType.PASSWORD_CHANGED;
  userId: string;
}

export interface UserCreatedEvent {
  type: UserEventType.CREATED;
  userId: string;
  name: string;
}

export interface UserNameChangedEvent {
  type: UserEventType.NAME_CHANGED;
  userId: string;
  originName: string;
  currentName: string;
}

export type UserEventPayload = UserCreatedEvent
  | UserNameChangedEvent
  | UserEmailChangedEvent
  | UserPasswordChangedEvent;

@Entity()
export class UserEvent {

  @PrimaryGeneratedColumn('uuid')
  readonly id = uuidV1();

  @Column()
  readonly timestamp: Date = new Date();

  @Column()
  readonly version: number;

  @ManyToOne(() => User)
  readonly user: User;

  @Column('json')
  readonly payload: UserEventPayload;

  constructor(user: User, payload: UserEventPayload) {
    this.user = user;
    this.version = user.version;
    this.payload = payload;
  }
}
