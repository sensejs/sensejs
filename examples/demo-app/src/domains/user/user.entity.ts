import {PasswordHash} from './password-hash';
import {Email} from './email';
import {Column, Entity, PrimaryColumn, VersionColumn} from 'typeorm';
import {uuidV1} from '@sensejs/utility';
import {
  UserCreatedEvent,
  UserEmailChangedEvent,
  UserEmailVerifiedEvent,
  UserEvent,
  UserEventPayload,
  UserEventType,
  UserNameChangedEvent,
  UserPasswordChangedEvent,
} from './user-event.entity';
import {EventRecorder} from '../common/event-recorder';
import {EventRecording} from '../common/event-recording';

export const UserEventRecorder = EventRecorder.from(
  UserEvent,
  (payload: UserEventPayload[], user: User) => new UserEvent(user, payload),
);

export class UserDomainError extends Error {
  constructor(readonly reason: string) {
    super();
    Error.captureStackTrace(this, UserDomainError);
  }
}

@Entity()
@EventRecording(UserEventRecorder)
export class User {

  @PrimaryColumn()
  readonly id: string = uuidV1();

  @VersionColumn()
  private readonly version: number = 0;

  @Column()
  private eventIndex: number = 0;

  @Column({unique: true})
  private name: string;

  @Column(() => Email)
  private email?: Email;

  @Column(() => PasswordHash)
  private password?: PasswordHash;

  @Column()
  private createdTime: Date;

  constructor(name: string) {
    this.name = name;
    this.createdTime = new Date();
  }

  static create(name: string) {
    const user = new User(name);
    user.created();
    return user;
  }

  @EventRecording(UserEventRecorder)
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
      index: this.eventIndex++,
      originEmailAddress: originEmail?.address,
      currentEmailAddress: email?.address,
    };
  }

  @EventRecording(UserEventRecorder)
  verifyEmail(): UserEmailVerifiedEvent | void {
    if (typeof this.email === 'undefined') {
      throw new UserDomainError('email is not binded yet');
    }
    if (this.email.isVerified()) {
      return;
    }
    this.email.verifyEmail();
    return {
      type: UserEventType.EMAIL_VERIFIED,
      userId: this.id,
      index: this.eventIndex++,
      emailAddress: this.email.addressNormalized
    };
  }

  @EventRecording(UserEventRecorder)
  changePassword(password: PasswordHash): UserPasswordChangedEvent {
    this.password = password;
    return {
      type: UserEventType.PASSWORD_CHANGED,
      userId: this.id,
      index: this.eventIndex++,
    };
  }

  @EventRecording(UserEventRecorder)
  changeName(name: string): UserNameChangedEvent {
    const originName = this.name;
    this.name = name;
    return {
      type: UserEventType.NAME_CHANGED,
      userId: this.id,
      index: this.eventIndex++,
      originName,
      currentName: name,
    };
  }

  @EventRecording(UserEventRecorder)
  private created(): UserCreatedEvent {
    return {
      type: UserEventType.CREATED,
      userId: this.id,
      index: this.eventIndex++,
      name: this.name,
    };
  }
}
