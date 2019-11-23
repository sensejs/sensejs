import {Entity, PrimaryGeneratedColumn, Column} from 'typeorm';
import {BookEntity} from './book.entity';

@Entity()
export class AuthorEntity {
  static create(name: string) {
    const author = new AuthorEntity();
    author.name = name;
    return author;
  }

  @PrimaryGeneratedColumn()
  id?: string;

  @Column()
  name?: string;

  @Column()
  bookCount: number = 0;

  writeBook(bookName: string): BookEntity {
    this.bookCount++;
    return BookEntity.create(bookName, this);
  }
}
