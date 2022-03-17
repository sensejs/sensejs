import {Entity, ManyToOne, Property} from '@mikro-orm/core';
import {AuthorEntity} from './author.entity';
import crypto from 'crypto';

@Entity()
export class BookEntity {
  @Property({primary: true})
  id: string = crypto.randomUUID();

  @Property()
  name: string;

  @ManyToOne(() => AuthorEntity)
  author: AuthorEntity;

  constructor(name: string, author: AuthorEntity) {
    this.name = name;
    this.author = author;
  }
}
