import {ModuleRoot, Module, RequestInterceptor, RequestContext, ServiceIdentifier, Component} from '@sensejs/core';
import {Container, inject} from 'inversify';
import {Column, Entity, PrimaryColumn, Repository, TableInheritance, ChildEntity} from 'typeorm';
import {InjectRepository, TypeOrmSupportInterceptor, TypeOrmModule} from '../src';

class MockRequestContext extends RequestContext {
  constructor(private container: Container) {
    super();
  }

  bindContextValue<T>(key: ServiceIdentifier<T>, value: T): void {
    this.container.bind(key).toConstantValue(value);
  }
}

describe('TypeOrmModule', () => {
  test('entity metadata and repositories shall be injectable on both global and child container', async () => {
    @Entity()
    @TableInheritance({column: {name: 'type', type: 'varchar'}})
    class Content {
      @PrimaryColumn()
      id?: string;

      @Column()
      description?: string;

      constructor(id: string | undefined, description: string) {
        this.id = id;
        this.description = description;
      }
    }

    @ChildEntity('photo')
    class Photo extends Content {
      @Column()
      imageUrl?: string;

      constructor(id: string | undefined, description: string, url: string) {
        super(id, description);
        this.imageUrl = url;
      }
    }

    @ChildEntity('video')
    class Video extends Content {
      @Column()
      videoUrl?: string;

      constructor(id: string | undefined, description: string, url: string) {
        super(id, description);
        this.videoUrl = url;
      }
    }

    @Component()
    class ExampleHttpController {
      constructor(
        @InjectRepository(Content) private contentRepository: Repository<Content>,
        @InjectRepository(Video) private videoRepository: Repository<Video>,
        @InjectRepository(Photo) private photoRepository: Repository<Photo>,
      ) {}

      async createVideo(id: string, description: string, url: string) {
        return this.videoRepository.insert(new Video(id, description, url));
      }

      async createPhoto(id: string, description: string, url: string) {
        return this.photoRepository.insert(new Photo(id, description, url));
      }

      async findBook() {
        return this.contentRepository.find();
      }
    }

    const typeOrmModule = TypeOrmModule({
      typeOrmOption: {
        type: 'sqlite',
        database: ':memory:',
        synchronize: true,
        entities: [Photo, Video, Content],
        logging: true,
      },
    });

    const spy = jest.fn();

    class FooModule extends Module({
      components: [ExampleHttpController, TypeOrmSupportInterceptor],
      requires: [typeOrmModule],
    }) {
      constructor(
        @inject(TypeOrmSupportInterceptor) private interceptor: RequestInterceptor,
        @inject(Container) private container: Container,
      ) {
        super();
      }

      async onCreate() {
        const childContainer = this.container.createChild();
        const context = new MockRequestContext(childContainer);
        const controller = this.container.get(ExampleHttpController);
        const now = Date.now();
        const vid = `v${now}`;
        const pid = `p${now}`;
        const baseId = Date.now();
        const url = `url_${Date.now()}`;
        const videoName = `video_${Date.now()}}`;
        const photoName = `photo_${Date.now()}}`;
        await controller.createVideo('v' + baseId, videoName, url);
        await controller.createPhoto('p' + baseId, photoName, url);
        const result = await controller.findBook();
        expect(result).toEqual(
          expect.arrayContaining([
            expect.objectContaining({id: vid, description: videoName, videoUrl: url}),
            expect.objectContaining({id: pid, description: photoName, imageUrl: url}),
          ]),
        );
        await this.interceptor.intercept(context, () => Promise.resolve());
        childContainer.get<ExampleHttpController>(ExampleHttpController);
        spy();
      }
    }

    const moduleRoot = new ModuleRoot(FooModule);
    await moduleRoot.start();
    await moduleRoot.stop();
    expect(spy).toBeCalled();
  });
});
