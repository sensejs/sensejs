import {
  Component,
  Constructor,
  Inject,
  ModuleClass,
  ModuleRoot,
  OnModuleCreate,
  RequestContext,
  RequestInterceptor,
} from '@sensejs/core';
import {Container, ResolveSession} from '@sensejs/container';
import {ChildEntity, Column, Entity, PrimaryColumn, Repository, TableInheritance} from 'typeorm';
import {
  createTypeOrmModule,
  InjectCustomRepository,
  InjectMongoRepository,
  InjectRepository,
  InjectTreeRepository,
  Transactional,
} from '../src';
import '@sensejs/testing-utility/lib/mock-console';

class MockRequestContext extends RequestContext {
  get targetConstructor(): Constructor {
    throw new Error('mock');
  }

  get targetMethodKey(): keyof any {
    throw new Error('mock');
  }

  constructor(protected resolveSession: ResolveSession) {
    super();
  }
}

describe('InjectRepository', () => {
  test('should throw error for invalid entity', () => {
    expect(() => InjectRepository(undefined as any)).toThrow(TypeError);
    expect(() => InjectMongoRepository(undefined as any)).toThrow(TypeError);
    expect(() => InjectTreeRepository(undefined as any)).toThrow(TypeError);
    expect(() => InjectCustomRepository(undefined as any)).toThrow(TypeError);
  });
});

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

    const typeOrmModule = createTypeOrmModule({
      typeOrmOption: {
        type: 'sqlite',
        database: ':memory:',
        synchronize: true,
        entities: [Photo, Video, Content],
        logging: true,
      },
    });

    const spy = jest.fn();
    const transactionalSupportInterceptor = Transactional();

    @ModuleClass({
      components: [ExampleHttpController, transactionalSupportInterceptor],
      requires: [typeOrmModule],
    })
    class FooModule {
      constructor(
        @Inject(transactionalSupportInterceptor) private interceptor: RequestInterceptor,
        @Inject(Container) private container: Container,
      ) {}

      @OnModuleCreate()
      async onCreate() {
        const resolveContext = this.container.createResolveContext();
        const context = new MockRequestContext(resolveContext);
        const controller = this.container.resolve(ExampleHttpController);
        const now = Date.now();
        const vid = `v${now}`;
        const pid = `p${now}`;
        const url = `url_${now}`;
        const videoName = `video_${now}`;
        const photoName = `photo_${now}`;
        await controller.createVideo(vid, videoName, url);
        await controller.createPhoto(pid, photoName, url);
        const result = await controller.findBook();
        expect(result).toEqual(
          expect.arrayContaining([
            expect.objectContaining({id: vid, description: videoName, videoUrl: url}),
            expect.objectContaining({id: pid, description: photoName, imageUrl: url}),
          ]),
        );
        await this.interceptor.intercept(context, () => Promise.resolve());
        resolveContext.resolve(ExampleHttpController);
        spy();
      }
    }

    const moduleRoot = new ModuleRoot(FooModule);
    await moduleRoot.start();
    await moduleRoot.stop();
    expect(spy).toBeCalled();
  });
});
