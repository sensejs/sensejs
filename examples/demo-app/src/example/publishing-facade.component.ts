import {AuthorEntity} from './author.entity.js';
import {BookEntity} from './book.entity.js';
import {Component, Inject} from '@sensejs/core';
import {EntityManager} from '@mikro-orm/core';

@Component()
export class PublishingFacade {
  constructor(@Inject(EntityManager) private entityManager: EntityManager) {}

  createAuthor(authorName: string) {
    const author = new AuthorEntity(authorName);
    this.entityManager.getRepository(AuthorEntity).persistLater(author);
    return author;
  }

  async createBook(authorId: string, bookName: string) {
    const author = await this.entityManager.findOneOrFail(AuthorEntity, {id: authorId});
    const book = author.writeBook(bookName);
    this.entityManager.getRepository(BookEntity).persistLater(book);
    return book;
  }
}
