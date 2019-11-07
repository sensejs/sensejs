
import {Entity, PrimaryGeneratedColumn, Column} from 'typeorm';
import {Book} from './book';

@Entity()
export class Author {

    static create(name: string) {
        const author = new Author();
        author.name = name;
        return author;
    }

    @PrimaryGeneratedColumn()
    id?: string;

    @Column()
    name?: string;

    @Column()
    bookCount: number = 0;

    writeBook(bookName: string): Book {
        this.bookCount++;
        return Book.create(bookName, this);
    }

}
