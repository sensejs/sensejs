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
    expect(metadata.functionParamMetadata.get('handleGet')).toEqual({
      method: HttpMethod.GET,
      path: '/get',
      params: expect.any(Map),
    });
    const postMetadata = metadata.functionParamMetadata.get('handlePost');
    expect(postMetadata).toEqual({
      method: HttpMethod.POST,
      path: '/:id',
      params: expect.any(Map)
    });

    expect(postMetadata!.params.get(0)).toEqual(expect.objectContaining({type: HttpParamType.BODY}));
    expect(postMetadata!.params.get(1)).toEqual(expect.objectContaining({type: HttpParamType.QUERY}));
    expect(postMetadata!.params.get(2)).toEqual(expect.objectContaining({type: HttpParamType.PATH, name: 'id'}));
    expect(postMetadata!.params.get(3)).toEqual(expect.objectContaining({type: HttpParamType.HEADER, name: 'cookie'}));

    expect(metadata.functionParamMetadata.get('handleDelete')).toEqual({
      method: HttpMethod.DELETE,
      path: '/:id',
      params: expect.objectContaining({}),
    });
    expect(metadata.functionParamMetadata.get(handlePut)).toEqual({
      method: HttpMethod.PUT,
      path: '/:id',
      params: expect.objectContaining({}),
    });
    expect(metadata.functionParamMetadata.get('handlePatch')).toEqual({
      method: HttpMethod.PATCH,
      path: '/',
      params: expect.objectContaining({}),
    });

  });
});
