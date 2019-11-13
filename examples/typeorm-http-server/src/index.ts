import 'reflect-metadata';
import {ApplicationFactory} from '@sensejs/core';
import {Body, Controller, GET, HttpConfigType, HttpModule, Path, POST, Query} from '@sensejs/http';
import {InjectRepository, TypeOrmModule, TypeOrmSupportInterceptor} from '@sensejs/typeorm';
import {Repository} from 'typeorm';

import {Author} from './entities/author';
import {Book} from './entities/book';

@Controller('/example')
class ExampleHttpController {
  constructor(
    @InjectRepository(Book) private bookRepository: Repository<Book>,
    @InjectRepository(Author) private authorRepository: Repository<Author>,
  ) {}

  @GET('/')
  handleGetRequest(@Query() query: object) {
    return {
      query,
      timestamp: Date.now(),
    };
  }

  @POST('/author')
  async createAuthor(@Body() body: {name: string}) {
    const author = Author.create(body.name);
    await this.authorRepository.insert(author);
    return author;
  }

  @POST('/author/:id/book')
  async createBook(@Body() body: {name: string}, @Path('id') id: string) {
    const author = await this.authorRepository.findOneOrFail(id);
    const book = author.writeBook(body.name);
    await this.bookRepository.insert(book);
    await this.authorRepository.save(author);
    return book;
  }
}

const typeOrmModule = TypeOrmModule({
  typeOrmOption: {
    type: 'sqlite',
    database: 'tmp.db',
    synchronize: true,
    entities: [Book, Author],
  },
});

const httpModule = HttpModule({
  type: HttpConfigType.static,
  requires: [typeOrmModule],
  staticHttpConfig: {
    listenPort: 3000,
    listenAddress: '0.0.0.0',
  },
  inspectors: [TypeOrmSupportInterceptor],
  components: [ExampleHttpController],
});

new ApplicationFactory(httpModule).start();
