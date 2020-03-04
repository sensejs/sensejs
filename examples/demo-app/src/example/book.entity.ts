import {Column, Entity, ManyToOne, PrimaryGeneratedColumn} from 'typeorm';
import {AuthorEntity} from './author.entity';

@Entity()
export class BookEntity {

  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  name?: string;

  @ManyToOne(() => AuthorEntity)
  author?: AuthorEntity;

  static create(name: string, author: AuthorEntity): BookEntity {
    const result = new BookEntity();
    result.name = name;
    result.author = author;
    return result;
  }
}
