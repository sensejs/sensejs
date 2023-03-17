import {Entity, Property} from '@mikro-orm/core';
import {BookEntity} from './book.entity.js';
import crypto from 'crypto';

@Entity()
export class AuthorEntity {
  @Property({primary: true})
  id: string = crypto.randomUUID();

  @Property()
  name: string;

  @Property()
  bookCount: number = 0;

  constructor(name: string) {
    this.name = name;
  }

  writeBook(bookName: string): BookEntity {
    this.bookCount++;
    return new BookEntity(bookName, this);
  }
}
