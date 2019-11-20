import 'reflect-metadata';
import {Body, Controller, GET, HttpModule, Path, POST, Query} from '@sensejs/http';
import {InjectRepository, MikroOrmModule, MikroOrmInterceptor} from '@sensejs/mikro-orm';
import {EntityRepository} from 'mikro-orm';
import {Author} from './entities/author';
import {Book} from './entities/book';

@Controller('/example')
class ExampleHttpController {
  constructor(
    @InjectRepository(Book) private bookRepository: EntityRepository<Book>,
    @InjectRepository(Author) private authorRepository: EntityRepository<Author>,
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
    const author = new Author(body.name as string);
    await this.bookRepository.persistAndFlush(author);
    return author;
  }

  @POST('/author/:id/book')
  async createBook(@Body() body: {name: string}, @Path('id') id: string) {
    const author = await this.authorRepository.findOneOrFail(id);
    const book = author.writeBook(body.name);
    await this.bookRepository.persist(book);
    await this.authorRepository.persistAndFlush(author);
    return book;
  }
}

const mikroOrmModule = MikroOrmModule({
  mikroOrmOption: {
    dbName: 'test-mikro-orm',
    entitiesDirs: ['./entities'],
    baseDir: __dirname,
    entities: [Book, Author],
    entitiesDirsTs: ['../../src/mikro-orm/entities'],
  },
});

// @EntryPoint()
class App extends HttpModule({
  requires: [mikroOrmModule],
  httpOption: {
    listenPort: 3000,
    listenAddress: '0.0.0.0',
  },
  globalInterceptors: [MikroOrmInterceptor],
  components: [ExampleHttpController],
}) {}
