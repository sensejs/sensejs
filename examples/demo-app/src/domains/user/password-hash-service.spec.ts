import {PasswordHashService} from './password-hash-service';

describe('PasswordDeriveService', () => {
  test('derive', async () => {
    const pds = new PasswordHashService();
    const password = await pds.derivePassword('foo');
    await pds.verifyPassword('foo', password);
  });
});
