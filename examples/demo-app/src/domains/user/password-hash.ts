import {Column} from 'typeorm';
import {ByteColumn} from '../../common/bytes-column';

export class PasswordHash {

  @ByteColumn()
  readonly salt: Buffer;

  @Column('varchar')
  readonly algorithm: string;

  @Column('int')
  readonly iteration: number;

  @ByteColumn()
  readonly result: Buffer;

  @Column()
  readonly updatedTime: Date;

  constructor(salt: Buffer, deriveMethod: string, deriveIteration: number, derivedKey: Buffer, updatedTime: Date) {
    this.salt = salt;
    this.algorithm = deriveMethod;
    this.iteration = deriveIteration;
    this.result = derivedKey;
    this.updatedTime = updatedTime;
  }

}
