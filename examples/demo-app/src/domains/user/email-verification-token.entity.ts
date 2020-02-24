import {Column, Entity, PrimaryColumn, ManyToOne} from 'typeorm';
import {uuidV1} from '@sensejs/utility';
import {User} from './user.entity';

@Entity()
export class EmailVerificationToken {

  @PrimaryColumn()
  readonly token: string = uuidV1();

  @Column()
  readonly createdTime: Date;

  @Column()
  readonly expiredTime: Date;

  @ManyToOne(() => User)
  readonly user: User;

  constructor(user: User, expireMilliseconds: number) {
    this.user = user;
    this.createdTime = new Date();
    this.expiredTime = new Date(this.createdTime.getTime() + expireMilliseconds);
  }
}
