import {PasswordHash} from './password-hash';
import {randomBytes, scrypt, timingSafeEqual} from 'crypto';
import {promisify} from 'util';

export class PasswordHashService {

  constructor(
    private defaultKeyDeriveFunction = 'scrypt',
    private defaultKeyDeriveIteration = 16384,
    private defaultKeyLength = 256,
    private defaultSaltLength = 8,
  ) {
  }

  async scrypt(salt: Buffer, length: number, iteration: number, cleartext: string): Promise<Buffer> {

    return new Promise((resolve, reject) => {
      return scrypt(cleartext, salt, length, {N: iteration}, (e, key) => {
        if (e) {
          return reject(e);
        }
        return resolve(key);
      });
    });
  }

  async derivePassword(password: string): Promise<PasswordHash> {
    const salt = await promisify(randomBytes)(this.defaultSaltLength);
    const length = this.defaultKeyLength;
    const iteration = this.defaultKeyDeriveIteration;
    const key = await this.scrypt(salt, length, iteration, password);
    return new PasswordHash(salt, this.defaultKeyDeriveFunction, iteration, key, new Date());
  }

  async verifyPassword(cleartextPassword: string, password: PasswordHash) {
    const {salt, iteration, result} = password;
    const length = result.length;
    return timingSafeEqual(await this.scrypt(salt, length, iteration, cleartextPassword), result);
  }

}
