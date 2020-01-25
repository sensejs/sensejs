import {PasswordHash} from './password-hash';
import {Email} from './email';
import {Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique, VersionColumn} from 'typeorm';
import {uuidV1} from '@sensejs/utility';

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
  userId: string;
  originName: string;
  currentName: string;
}

export type UserEventPayload = UserCreatedEvent
  | UserNameChangedEvent
  | UserEmailChangedEvent
  | UserPasswordChangedEvent;

@Entity()
@Unique(['user.email'])
export class User {

  @PrimaryGeneratedColumn()
  readonly id: string = uuidV1();

  @VersionColumn()
  readonly version: number = 0;

  @OneToMany(() => UserEvent, (userEvent) => userEvent.user, {cascade: true})
  readonly pendingEvents: UserEventPayload[] = [];

  @Column({unique: true})
  private name: string;

  private email?: Email;

  private password?: PasswordHash;

  private createdTime: Date;

  constructor(name: string) {
    this.name = name;
    this.createdTime = new Date();
    this.pendingEvents.push({
      type: UserEventType.CREATED,
      userId: this.id,
      name,
    });
  }

  changeEmail(email?: Email) {
    if (email !== undefined && email.equalTo(this.email)) {
      return this;
    }
    if (email === this.email) {
      return this;
    }
    const originEmail = this.email;
    this.email = email;
    this.pendingEvents.push({
      type: UserEventType.EMAIL_CHANGED,
      userId: this.id,
      originEmailAddress: originEmail?.address,
      currentEmailAddress: email?.address,
    });
    return this;
  }

  changePassword(password: PasswordHash) {
    this.password = password;
    this.pendingEvents.push({
      type: UserEventType.PASSWORD_CHANGED,
      userId: this.id,
    });
    return this;
  }
}

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
  readonly payload: UserEventPayload[];

  constructor(user: User) {
    this.user = user;
    this.version = user.version;
    this.payload = user.pendingEvents;
  }
}
