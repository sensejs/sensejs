import {Entity, MongoEntity, PrimaryKey, ManyToOne, Property, wrap} from 'mikro-orm';
import {ObjectId} from 'bson';
import {Author} from './author';

@Entity()
export class Book implements MongoEntity<Book> {
  @PrimaryKey()
  _id: ObjectId = new ObjectId();

  get id() {
    return this._id.toHexString();
  }

  @ManyToOne()
  author: Author;

  @Property()
  name: string;

  toJSON(): object {
    return wrap(this).toJSON();
  }

  constructor(name: string, author: Author) {
    this.name = name;
    this.author = author;
  }
}
