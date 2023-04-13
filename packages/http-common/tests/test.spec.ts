import {jest} from '@jest/globals';
import {
  AbstractHttpApplicationBuilder,
  AbstractHttpModule,
  Body,
  Controller,
  DELETE,
  ensureMetadataOnPrototype,
  GET,
  getHttpControllerMetadata,
  getRequestMappingMetadata,
  Header,
  HttpMethod,
  HttpParamType,
  MultipartBody,
  PATCH,
  Path,
  POST,
  PUT,
  Query,
} from '../src/index.js';
import {Container, Inject, Middleware} from '@sensejs/container';
import {RequestListener} from 'http';
import {Component, Module, EntryModule, ProcessManager} from '@sensejs/core';
import {MultipartReader} from '@sensejs/multipart';

describe('Http annotations', () => {
  test('metadata', () => {
    const handlePut = Symbol();

    @Middleware()
    class I1 {
      async handle() {}
    }

    @Middleware()
    class I2 {
      async handle() {}
    }
    const L1 = Symbol();

    @Controller('/', {middlewares: [I1], labels: [L1]})
    class FooController {
      @GET('/get', {middlewares: [I2]})
      handleGet() {}

      @POST('/:id')
      handlePost(
        @Body() body: object,
        @Query() query: object,
        @Path('id') path: string,
        @Header('cookie') cookie: string,
      ) {}

      @DELETE('/:id')
      handleDelete(@Path('id') uuid: string) {}

      @PUT('/:id')
      [handlePut](@Path('id') id: number) {}

      @PATCH('/')
      handlePatch() {}

      @POST('multipart')
      handleMultipart(@MultipartBody() body: MultipartReader) {}
    }

    const cm = getHttpControllerMetadata(FooController);
    expect(cm).toEqual(
      expect.objectContaining({
        target: FooController,
        path: '/',
        middlewares: expect.arrayContaining([I1]),
        prototype: FooController.prototype,
      }),
    );
    expect(Array.from(cm!.labels)).toEqual(expect.arrayContaining([L1]));
    const rm = getRequestMappingMetadata(FooController.prototype, 'handleGet');
    expect(rm).toEqual(
      expect.objectContaining({
        httpMethod: HttpMethod.GET,
        middlewares: expect.arrayContaining([I2]),
        path: '/get',
      }),
    );

    const metadata = ensureMetadataOnPrototype(FooController.prototype);
    expect(metadata.get('handleGet')).toEqual({
      params: expect.any(Map),
    });
    const postMetadata = metadata.get('handlePost');
    expect(postMetadata).toEqual({
      params: expect.any(Map),
    });

    expect(postMetadata!.params.get(0)).toEqual(expect.objectContaining({type: HttpParamType.BODY}));
    expect(postMetadata!.params.get(1)).toEqual(expect.objectContaining({type: HttpParamType.QUERY}));
    expect(postMetadata!.params.get(2)).toEqual(expect.objectContaining({type: HttpParamType.PATH, name: 'id'}));
    expect(postMetadata!.params.get(3)).toEqual(expect.objectContaining({type: HttpParamType.HEADER, name: 'cookie'}));

    expect(metadata.get('handleDelete')).toEqual({
      params: expect.objectContaining({}),
    });
    expect(metadata.get(handlePut)).toEqual({
      params: expect.objectContaining({}),
    });
    expect(metadata.get('handlePatch')).toEqual({
      params: expect.objectContaining({}),
    });
  });

  describe('@MultipartBody', () => {
    test('throws when parameter type is not MultipartReader', () => {
      expect(() => {
        class Test {
          @POST('/multipart')
          handleMultipart(@MultipartBody() body: any) {}
        }
      }).toThrowError();

      expect(() => {
        class Test {
          @POST('/multipart')
          handleMultipart(@MultipartBody() body: object) {}
        }
      }).toThrowError();
    });
  });
});

test('Adaptor and abstract module', async () => {
  class TestAdaptor extends AbstractHttpApplicationBuilder {
    build(container: Container): RequestListener {
      return () => {
        throw new Error();
      };
    }
  }

  const addControllerSpy = jest.spyOn(TestAdaptor.prototype, 'addControllerWithMetadata');
  const addRouterSpy = jest.spyOn(TestAdaptor.prototype, 'addRouterSpec');

  const createMiddleware = () => {
    @Middleware()
    class M {
      handle(next: () => Promise<void>) {
        return next();
      }
    }
    return M;
  };

  @Controller('/', {middlewares: [createMiddleware()]})
  class TestController {
    @GET('/', {middlewares: [createMiddleware()]})
    foo() {}
  }

  @Controller('/', {middlewares: [createMiddleware()], labels: ['foobar']})
  class Test1Controller {
    @GET('/', {middlewares: [createMiddleware()]})
    foo() {}
  }

  @Component()
  class NonController {}
  @Module({
    components: [TestController, Test1Controller, NonController],
  })
  class TestHttpModule extends AbstractHttpModule {
    constructor() {
      super({
        httpOption: {
          listenPort: 0,
        },
        matchLabels: (labels) => labels.size == 0,
        middlewares: [createMiddleware()],
      });
    }

    main(@Inject(ProcessManager) pm: ProcessManager) {
      const expectControllerContaining = expect.objectContaining({
        target: TestController,
        prototype: TestController.prototype,
      });
      expect(addControllerSpy).toHaveBeenCalledWith(expectControllerContaining);
      expect(addControllerSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          target: Test1Controller,
        }),
      );
      expect(addRouterSpy).toHaveBeenCalledWith(
        expect.anything(),
        expectControllerContaining,
        TestController.prototype,
        'foo',
      );
      pm.shutdown();
    }

    protected getAdaptor(): AbstractHttpApplicationBuilder {
      return new TestAdaptor().addMiddlewares(createMiddleware());
    }
  }

  await EntryModule.start(TestHttpModule, 'main');
});
