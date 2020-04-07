import {Constructor, Inject} from '@sensejs/core';
import {Container} from 'inversify';
import supertest from 'supertest';
import {
  Body,
  Controller,
  DELETE,
  GET,
  getHttpControllerMetadata,
  Header,
  HttpContext,
  HttpInterceptor,
  KoaHttpApplicationBuilder,
  KoaHttpContext,
  PATCH,
  Path,
  POST,
  PUT,
  Query,
} from '../src';

describe('KoaHttpApplicationBuilder', () => {
  const makeMockInterceptor = (stub: jest.Mock<any>, symbol: symbol): Constructor<HttpInterceptor> => {
    return class extends HttpInterceptor {
      async intercept(context: HttpContext, next: () => Promise<void>) {
        stub('before');
        expect(context.nativeRequest).toBeDefined();
        expect(context.nativeResponse).toBeDefined();

        const statusCode = context.response.statusCode;
        const data = context.response.data;

        // Setter
        context.response.statusCode = statusCode;
        context.response.data = data;

        context.bindContextValue(symbol, Math.random());
        await next();
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
      unusedMethod() {}

      @GET('/', {interceptors: [InterceptorC]})
      get(
        @Inject(HttpContext) ctx: HttpContext,
        @Inject(symbolA) numberA: number,
        @Inject(symbolB) numberB: number,
        @Inject(symbolC) numberC: number,
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
    const koaHttpApplicationBuilder = new KoaHttpApplicationBuilder();
    koaHttpApplicationBuilder.addGlobalInspector(InterceptorA);
    koaHttpApplicationBuilder.addControllerWithMetadata(getHttpControllerMetadata(FooController)!);
    const koaHttpApplication = koaHttpApplicationBuilder.build({}, container);
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
    const controllerSpy = jest.fn();

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

        controllerSpy();
      }
    }

    const container = new Container();
    container.bind(FooController).toSelf();
    const koaHttpApplicationBuilder = new KoaHttpApplicationBuilder();
    const middlewareSpy = jest.fn();
    koaHttpApplicationBuilder.clearMiddleware();
    koaHttpApplicationBuilder.addMiddleware((ctx, next) => {
      middlewareSpy();
      return next();
    });
    koaHttpApplicationBuilder.addControllerWithMetadata(getHttpControllerMetadata(FooController)!);
    const koaHttpApplication = koaHttpApplicationBuilder.build({}, container);
    const testClient = supertest((req: any, res: any) => koaHttpApplication(req, res));

    await testClient
      .post('/foo/' + timestamp + '?timestamp=' + timestamp)
      .set('x-timestamp', timestamp.toString())
      .send({timestamp});
    expect(controllerSpy).toHaveBeenCalled();
    expect(middlewareSpy).toHaveBeenCalled();
  });
});
