import {Entity, Property} from '@mikro-orm/core';
import {BookEntity} from './book.entity.js';
import {randomUUID} from 'crypto';

@Entity()
export class AuthorEntity {
  @Property({primary: true})
  id: string = randomUUID();

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
