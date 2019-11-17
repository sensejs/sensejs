import {AuthorEntity} from './author.entity';
import {BookEntity} from './book.entity';
import {InjectRepository} from '@sensejs/typeorm';
import {Repository} from 'typeorm';
import {Component} from '@sensejs/core';

@Component()
export class WritingFacade {
  constructor(
    @InjectRepository(BookEntity) private bookRepository: Repository<BookEntity>,
    @InjectRepository(AuthorEntity) private authorRepository: Repository<AuthorEntity>,
  ) {}

  async createAuthor(authorName: string) {
    const author = AuthorEntity.create(authorName);
    await this.authorRepository.insert(author);
    return author;
  }

  async createBook(authorId: string, bookName: string) {
    const author = await this.authorRepository.findOneOrFail(authorId);
    const book = author.writeBook(bookName);
    await this.bookRepository.insert(book);
    await this.authorRepository.save(author);
    return book;
  }
}
