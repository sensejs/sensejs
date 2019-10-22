import {Entity, MongoEntity, PrimaryKey, Property, wrap} from 'mikro-orm';
import {ObjectId} from 'bson';
import {Book} from './book';

@Entity()
export class Author implements MongoEntity<Author> {

    get id() { return this._id.toHexString(); }

    @PrimaryKey()
    _id: ObjectId = new ObjectId();

    @Property()
    name: string;

    @Property()
    bookCount: number = 0;

    constructor(name: string) {
        this.name = name;
    }

    toJSON(): object {
        return wrap(this).toJSON();
    }

    writeBook(bookName: string): Book {
        this.bookCount++;
        return new Book(bookName, this);
    }

}
