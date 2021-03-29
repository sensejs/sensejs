import {Body, Controller, DELETE, GET, getHttpControllerMetadata, Header, PATCH, Path, POST, PUT, Query} from '../src';

describe('Http decorators', () => {
  test('metadata', () => {
    @Controller('/foo')
    class FooController {
      @GET('/')
      handleRequest() {}

      @POST('/')
      noParam(
        @Body() body: object,
        @Query() query: object,
        @Path('id') path: string,
        @Header('cookie') cookie: string,
      ) {}

      @DELETE('/')
      handleDelete() {}

      @PUT('/')
      handlePut() {}

      @PATCH('/')
      handlePatch() {}
    }

    expect(getHttpControllerMetadata(FooController)).not.toBeUndefined();
  });

  test('throw error when apply decorator multiple times', () => {
    expect(() => {
      @Controller('/foo')
      @Controller('/foo')
      class MyController {
        @DELETE('/')
        handleRequest() {}
      }
    }).toThrow();

    expect(() => {
      class MyController {
        @GET('/')
        @PATCH('/')
        handleRequest() {}
      }
    }).toThrow();
  });
});
