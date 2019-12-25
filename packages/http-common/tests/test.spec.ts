import {
  Body,
  DELETE,
  ensureMetadataOnPrototype,
  GET,
  Header,
  HttpMethod,
  HttpParamType,
  PATCH,
  Path,
  POST,
  PUT,
  Query,
} from '../src';

describe('Http annotations', () => {
  test('metadata', () => {
    const handlePut = Symbol();

    class FooController {
      @GET('/get')
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

    const metadata = ensureMetadataOnPrototype(FooController.prototype);
    expect(metadata.get('handleGet')).toEqual({
      method: HttpMethod.GET,
      path: '/get',
      params: {},
    });
    expect(metadata.get('handlePost')).toEqual({
      method: HttpMethod.POST,
      path: '/:id',
      params: expect.objectContaining({
        0: expect.objectContaining({type: HttpParamType.BODY}),
        1: expect.objectContaining({type: HttpParamType.QUERY}),
        2: expect.objectContaining({type: HttpParamType.PATH, name: 'id'}),
        3: expect.objectContaining({type: HttpParamType.HEADER, name: 'cookie'}),
      }),
    });

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
