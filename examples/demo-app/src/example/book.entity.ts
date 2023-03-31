import {Entity, ManyToOne, Property, Rel} from '@mikro-orm/core';
import {AuthorEntity} from './author.entity.js';
import {randomUUID} from 'crypto';

@Entity()
export class BookEntity {
  @Property({primary: true})
  id: string = randomUUID();

  @Property()
  name: string;

  @ManyToOne(() => AuthorEntity)
  author: Rel<AuthorEntity>;

  constructor(name: string, author: Rel<AuthorEntity>) {
    this.name = name;
    this.author = author;
  }
}
