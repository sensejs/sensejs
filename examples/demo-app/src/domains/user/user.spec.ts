import {UserEventType} from './user-event.entity';
import {User} from './user.entity';
import {Email} from './email';
import {PasswordHashService} from './password-hash-service';

describe('User', () => {
  test('change email', async () => {
    const user = new User('name');
    const email = new Email('foo@bar.com');
    expect(user.changeEmail(email)).toEqual(expect.objectContaining({
      type: UserEventType.EMAIL_CHANGED,
      originEmailAddress: undefined,
      currentEmailAddress: email.address,
    }));
    expect(user.changePassword(
      await new PasswordHashService().derivePassword('foobar'),
    )).toEqual(expect.objectContaining({
      type: UserEventType.PASSWORD_CHANGED,
    }));
  });

});
