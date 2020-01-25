import {Column} from 'typeorm';

export class Email {

  @Column('varchar')
  readonly address: string;

  @Column('varchar')
  readonly addressNormalized: string;

  @Column()
  readonly updatedTime: Date;

  constructor(address: string, updatedTime = new Date()) {
    this.address = address;
    this.addressNormalized = address.toLowerCase();
    this.updatedTime = updatedTime;
  }

  equalTo(email?: Email) {
    return typeof email !== 'undefined' && this.addressNormalized === email.addressNormalized;
  }
}
