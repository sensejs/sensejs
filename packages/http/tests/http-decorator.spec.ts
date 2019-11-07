import 'reflect-metadata';
import {
  Body,
  Controller,
  DELETE,
  GET,
  getHttpControllerMetadata,
  Header,
  PATCH,
  Path,
  POST,
  PUT,
  Query,
} from '../src/http-decorators';

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

  test('throw error when lack of param mapping', () => {
    expect(() => {
      @Controller('/foo')
      class MyController {
        @GET('/')
        handleRequest(body: object) {}
      }
    }).toThrow();

    expect(() => {
      class MyController {
        @GET('/:id')
        handleRequest(body: object, @Path('id') path: string) {}
      }
    }).toThrow();
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

    expect(() => {
      class MyController {
        handleRequest(@Body() @Path('id') data: any) {}
      }
    }).toThrow();
  });

  test('throw error when misapplied', () => {
    expect(() => {
      class MyController {
        @GET('/')
        field: any;
      }
    }).toThrow();
  });
});
