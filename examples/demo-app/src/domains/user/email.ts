import {Column} from 'typeorm';

export class Email {

  @Column('varchar')
  readonly address: string;

  @Column('varchar')
  readonly addressNormalized: string;

  @Column()
  readonly updatedTime: Date;

  @Column('varchar', {nullable: true})
  verifiedTime?: Date;

  constructor(address: string, updatedTime = new Date(), verifiedTime?: Date) {
    this.address = address;
    this.addressNormalized = address.toLowerCase();
    this.updatedTime = updatedTime;
    this.verifiedTime = verifiedTime;
  }

  equalTo(email?: Email) {
    return typeof email !== 'undefined' && this.addressNormalized === email.addressNormalized;
  }

  verifyEmail() {
    this.verifiedTime = new Date();
  }

  isVerified() {
    return typeof this.verifiedTime !== 'undefined';
  }
}
