import {PasswordHash} from './password-hash';
import {Email} from './email';
import {Column, Entity, PrimaryGeneratedColumn, Unique, VersionColumn} from 'typeorm';
import {uuidV1} from '@sensejs/utility';
import {EnableEventRecord, EventRecorder} from '../../common/events/event-recording';
import {
  UserCreatedEvent,
  UserEmailChangedEvent,
  UserEvent,
  UserEventPayload,
  UserEventType,
  UserNameChangedEvent,
  UserPasswordChangedEvent,
} from './user-event.entity';

export const UserEventRecorder = EventRecorder.from(
  UserEvent,
  (payload: UserEventPayload, user: User) => new UserEvent(user, payload),
);

@Entity()
@Unique(['user.email'])
@EnableEventRecord(UserEventRecorder)
export class User {

  @PrimaryGeneratedColumn()
  readonly id: string = uuidV1();

  @VersionColumn()
  readonly version: number = 0;

  @Column({unique: true})
  private name: string;

  private email?: Email;

  private password?: PasswordHash;

  private createdTime: Date;

  constructor(name: string) {
    this.name = name;
    this.createdTime = new Date();
    this.created();
  }

  @EnableEventRecord(UserEventRecorder)
  changeEmail(email?: Email): UserEmailChangedEvent | void {
    if (email !== undefined && email.equalTo(this.email)) {
      return;
    }
    if (email === this.email) {
      return;
    }
    const originEmail = this.email;
    this.email = email;
    return {
      type: UserEventType.EMAIL_CHANGED,
      userId: this.id,
      originEmailAddress: originEmail?.address,
      currentEmailAddress: email?.address,
    };
  }

  @EnableEventRecord(UserEventRecorder)
  changePassword(password: PasswordHash): UserPasswordChangedEvent {
    this.password = password;
    return {
      type: UserEventType.PASSWORD_CHANGED,
      userId: this.id,
    };
  }

  @EnableEventRecord(UserEventRecorder)
  changeName(name: string): UserNameChangedEvent {
    const originName = this.name;
    this.name = name;
    return {
      type: UserEventType.NAME_CHANGED,
      userId: this.id,
      originName,
      currentName: name,
    };
  }

  @EnableEventRecord(UserEventRecorder)
  private created(): UserCreatedEvent {
    return {
      type: UserEventType.CREATED,
      userId: this.id,
      name: this.name,
    };
  }
}
