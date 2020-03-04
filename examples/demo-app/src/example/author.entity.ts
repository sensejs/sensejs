import {Column, Entity, PrimaryGeneratedColumn} from 'typeorm';
import {BookEntity} from './book.entity';

@Entity()
export class AuthorEntity {

  @PrimaryGeneratedColumn()
  id?: string;

  @Column()
  name?: string;

  @Column()
  bookCount: number = 0;

  static create(name: string) {
    const author = new AuthorEntity();
    author.name = name;
    return author;
  }

  writeBook(bookName: string): BookEntity {
    this.bookCount++;
    return BookEntity.create(bookName, this);
  }
}
