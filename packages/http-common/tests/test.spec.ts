import {
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
  PATCH,
  Path,
  POST,
  PUT,
  Query,
} from '../src/index.js';
import {InterceptProviderClass} from '../../container/src/decorator.js';

describe('Http annotations', () => {
  test('metadata', () => {
    const handlePut = Symbol();

    const generateInterceptorClass = () => {
      @InterceptProviderClass()
      class Interceptor {
        async intercept(cb: () => Promise<void>) {}
      }
      return Interceptor;
    };

    const I1 = generateInterceptorClass(),
      I2 = generateInterceptorClass();

    const L1 = Symbol();

    @Controller('/', {interceptProviders: [I1], labels: [L1]})
    class FooController {
      @GET('/get', {interceptProviders: [I2]})
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
    }

    const cm = getHttpControllerMetadata(FooController);
    expect(cm).toEqual(
      expect.objectContaining({
        target: FooController,
        path: '/',
        interceptProviders: expect.arrayContaining([I1]),
        prototype: FooController.prototype,
      }),
    );
    expect(Array.from(cm!.labels)).toEqual(expect.arrayContaining([L1]));
    const rm = getRequestMappingMetadata(FooController.prototype, 'handleGet');
    expect(rm).toEqual(
      expect.objectContaining({
        httpMethod: HttpMethod.GET,
        interceptProviders: expect.arrayContaining([I2]),
        path: '/get',
      }),
    );

    const metadata = ensureMetadataOnPrototype(FooController.prototype);
    expect(metadata.get('handleGet')).toEqual({
      method: HttpMethod.GET,
      path: '/get',
      params: expect.any(Map),
    });
    const postMetadata = metadata.get('handlePost');
    expect(postMetadata).toEqual({
      method: HttpMethod.POST,
      path: '/:id',
      params: expect.any(Map),
    });

    expect(postMetadata!.params.get(0)).toEqual(expect.objectContaining({type: HttpParamType.BODY}));
    expect(postMetadata!.params.get(1)).toEqual(expect.objectContaining({type: HttpParamType.QUERY}));
    expect(postMetadata!.params.get(2)).toEqual(expect.objectContaining({type: HttpParamType.PATH, name: 'id'}));
    expect(postMetadata!.params.get(3)).toEqual(expect.objectContaining({type: HttpParamType.HEADER, name: 'cookie'}));

    expect(metadata.get('handleDelete')).toEqual({
      method: HttpMethod.DELETE,
      path: '/:id',
      params: expect.objectContaining({}),
    });
    expect(metadata.get(handlePut)).toEqual({
      method: HttpMethod.PUT,
      path: '/:id',
      params: expect.objectContaining({}),
    });
    expect(metadata.get('handlePatch')).toEqual({
      method: HttpMethod.PATCH,
      path: '/',
      params: expect.objectContaining({}),
    });
  });
});
