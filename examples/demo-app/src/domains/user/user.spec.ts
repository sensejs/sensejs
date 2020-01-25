import {User, UserEventType} from './user.entity';
import {Email} from './email';
import {PasswordHashService} from './password-hash-service';

describe('User', () => {
  test('change email', async () => {
    const user = new User('name');
    expect(user.pendingEvents.slice(-1)[0]).toEqual(expect.objectContaining({
      type: UserEventType.CREATED,
      name: 'name',
    }));
    const email = new Email('foo@bar.com');
    user.changeEmail(email);
    expect(user.pendingEvents.slice(-1)[0]).toEqual(expect.objectContaining({
      type: UserEventType.EMAIL_CHANGED,
      originEmailAddress: undefined,
      currentEmailAddress: email.address,
    }));
    user.changePassword(await new PasswordHashService().derivePassword('foobar'));
    expect(user.pendingEvents.slice(-1)[0]).toEqual(expect.objectContaining({
      type: UserEventType.PASSWORD_CHANGED,
    }));
  });

});
