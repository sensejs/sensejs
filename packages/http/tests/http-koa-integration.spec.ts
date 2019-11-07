import 'reflect-metadata';
import {Body, Controller, DELETE, GET, Header, PATCH, Path, POST, PUT, Query} from '../src/http-decorators';
import supertest from 'supertest';
import {KoaHttpApplicationBuilder, KoaHttpContext} from '../src/http-koa-integration';
import {Container} from 'inversify';
import {HttpInterceptor, HttpContext} from '../src/http-abstract';
import {ParamBinding, Constructor} from '@sensejs/core';

describe('KoaHttpApplicationBuilder', () => {
  const makeMockInterceptor = (stub: jest.Mock<any>, symbol: Symbol): Constructor<HttpInterceptor> => {
    return class extends HttpInterceptor {
      async beforeRequest(context: HttpContext): Promise<void> {
        stub('before');
        context.bindContextValue(symbol, Math.random());
      }
      async afterRequest(context: HttpContext): Promise<void> {
        stub('after');
      }
    };
  };
  test('custom param binding', async () => {
    const stubForGet = jest.fn(),
      stubForPost = jest.fn(),
      stubForDelete = jest.fn(),
      stubForPatch = jest.fn(),
      stubForPut = jest.fn();
    const stubForA = jest.fn(),
      stubForB = jest.fn(),
      stubForC = jest.fn();
    const symbolA = Symbol('A'),
      symbolB = Symbol('B'),
      symbolC = Symbol('C');

    const InterceptorA = makeMockInterceptor(stubForA, symbolA);
    const InterceptorB = makeMockInterceptor(stubForB, symbolB);
    const InterceptorC = makeMockInterceptor(stubForC, symbolC);

    @Controller('/', {
      interceptors: [InterceptorB],
    })
    class FooController {
      @GET('/', {interceptors: [InterceptorC]})
      get(
        @ParamBinding(HttpContext) ctx: HttpContext,
        @ParamBinding(symbolA) numberA: number,
        @ParamBinding(symbolB) numberB: number,
        @ParamBinding(symbolC) numberC: number,
      ) {
        stubForGet(ctx);
      }

      @POST('/')
      post() {
        stubForPost();
      }

      @DELETE('/')
      delete() {
        stubForDelete();
      }

      @PATCH('/')
      patch() {
        stubForPatch();
      }

      @PUT('/')
      put() {
        stubForPut();
      }
    }

    const container = new Container();
    container.bind(FooController).toSelf();
    container.bind(InterceptorA).toSelf();
    container.bind(InterceptorB).toSelf();
    container.bind(InterceptorC).toSelf();
    const koaHttpApplicationBuilder = new KoaHttpApplicationBuilder(container);
    koaHttpApplicationBuilder.addGlobalInspector(InterceptorA);
    koaHttpApplicationBuilder.addController(FooController);
    const koaHttpApplication = koaHttpApplicationBuilder.build();
    const testClient = supertest((req: any, res: any) => koaHttpApplication(req, res));
    await testClient.get('/');
    await testClient.post('/');
    await testClient.delete('/');
    await testClient.put('/');
    await testClient.patch('/');
    expect(stubForGet).toBeCalledWith(expect.any(KoaHttpContext));
    expect(stubForPost).toBeCalled();
    expect(stubForDelete).toBeCalled();
    expect(stubForPut).toBeCalled();
    expect(stubForPost).toBeCalled();
    expect(stubForPatch).toBeCalled();
    expect(stubForA).toBeCalledWith('before');
    expect(stubForB).toBeCalledWith('before');
    expect(stubForC).toBeCalledWith('before');
    expect(stubForA).toBeCalledWith('after');
    expect(stubForB).toBeCalledWith('after');
    expect(stubForC).toBeCalledWith('after');
  });

  test('builtin param binding', async () => {
    const timestamp = Date.now().toString();
    const stub = jest.fn();

    @Controller('/foo')
    class FooController {
      @POST('/:path')
      post(
        @Body() httpBody: object,
        @Path('path') urlPath: string,
        @Query() httpQuery: object,
        @Header('x-timestamp') customHeader: string,
      ) {
        expect(httpBody).toEqual(expect.objectContaining({timestamp}));
        expect(httpQuery).toEqual(expect.objectContaining({timestamp}));
        expect(urlPath).toStrictEqual(timestamp);
        expect(customHeader).toStrictEqual(timestamp);

        stub();
      }
    }

    const container = new Container();
    container.bind(FooController).toSelf();
    const koaHttpApplicationBuilder = new KoaHttpApplicationBuilder(container);
    koaHttpApplicationBuilder.addController(FooController);
    const koaHttpApplication = koaHttpApplicationBuilder.build();
    const testClient = supertest((req: any, res: any) => koaHttpApplication(req, res));

    await testClient
      .post('/foo/' + timestamp + '?timestamp=' + timestamp)
      .set('x-timestamp', timestamp.toString())
      .send({timestamp});
    expect(stub).toHaveBeenCalled();
  });
});
