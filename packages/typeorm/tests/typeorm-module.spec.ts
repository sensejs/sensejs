import {ApplicationFactory, Module} from '@sensejs/core';
import {Controller, GET, HttpInterceptor, KoaHttpContext} from '@sensejs/http';
import {Container, inject} from 'inversify';
import {Column, Entity, PrimaryGeneratedColumn, Repository} from 'typeorm';
import {InjectRepository, SenseHttpInterceptor, TypeOrmModule} from '../src';

describe('TypeOrmModule', () => {
  test('common case', async () => {
    @Entity()
    class Book {
      @PrimaryGeneratedColumn()
      id?: number;

      @Column()
      name?: string;
    }

    @Controller('/example')
    class ExampleHttpController {
      constructor(@InjectRepository(Book) private bookRepository: Repository<Book>) {}

      async createBook(name: string) {
        const book = new Book();
        book.name = name;
        await this.bookRepository.insert(book);
        return book;
      }

      @GET('/book')
      async findBook() {
        return this.bookRepository.find();
      }
    }

    const typeOrmModule = TypeOrmModule({
      typeOrmOption: {
        type: 'sqlite',
        database: 'temp.db',
        synchronize: true,
        entities: [Book],
      },
    });

    const spy = jest.fn();

    class FooModule extends Module({components: [ExampleHttpController], requires: [typeOrmModule]}) {
      constructor(
        @inject(SenseHttpInterceptor) private interceptor: HttpInterceptor,
        @inject(Container) private container: Container,
      ) {
        super();
      }

      async onCreate() {
        const context = new KoaHttpContext(this.container);
        await this.interceptor.intercept(context, () => Promise.resolve());
        const controller = this.container.get(ExampleHttpController);
        const name = `test_${Date.now()}`;
        await controller.createBook(name);
        const result = await controller.findBook();
        const filtered = result.filter((x: Book) => x.name === name);
        expect(filtered.length).toBe(1);
        expect(filtered[0]).toEqual(expect.objectContaining({name}));
        spy();
      }

      async onDestroy() {}
    }

    const app = new ApplicationFactory(FooModule);
    await app.start();
    await app.stop();
    expect(spy).toBeCalled();
  });
});
