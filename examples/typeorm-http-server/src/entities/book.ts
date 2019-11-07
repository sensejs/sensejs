import {Column, Entity, ManyToOne, PrimaryGeneratedColumn} from 'typeorm';
import {Author} from './author';

@Entity()
export class Book {
  static create(name: string, author: Author): Book {
    const result = new Book();
    result.name = name;
    result.author = author;
    return result;
  }

  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  name?: string;

  @ManyToOne(() => Author)
  author?: Author;
}
