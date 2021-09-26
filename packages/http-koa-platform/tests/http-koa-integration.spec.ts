import '@sensejs/testing-utility/lib/mock-console';
import {jest} from '@jest/globals';
import {Constructor, Inject} from '@sensejs/core';
import {AsyncInterceptProvider, Container, InterceptProviderClass} from '@sensejs/container';
import supertest from 'supertest';
import {KoaHttpApplicationBuilder, KoaHttpContext} from '../src/index.js';
import {
  Query,
  Path,
  Header,
  POST,
  Body,
  PUT,
  PATCH,
  DELETE,
  GET,
  HttpContext,
  Controller,
  getHttpControllerMetadata,
} from '@sensejs/http-common';

describe('KoaHttpApplicationBuilder', () => {
  const makeMockInterceptor = (stub: jest.Mock<any>, symbol: symbol): Constructor<AsyncInterceptProvider> => {
    @InterceptProviderClass(symbol)
    class MockHttpInterceptProvider {
      constructor(@Inject(HttpContext) readonly context: HttpContext) {}

      async intercept(next: (value: number) => Promise<void>) {
        stub('before');
        expect(this.context.nativeRequest).toBeDefined();
        expect(this.context.nativeResponse).toBeDefined();
        expect(typeof this.context.targetConstructor).toBe('function');
        expect(typeof this.context.targetMethodKey).toBe('string');

        const statusCode = this.context.response.statusCode;
        const data = this.context.response.data;

        // Setter
        this.context.response.statusCode = statusCode;
        this.context.response.data = data;

        await next(Math.random());
        stub('after');
      }
    }

    return MockHttpInterceptProvider;
  };

  test('http context', async () => {
    const customHeaderKey = 'X-CUSTOM-HEADER';
    const customHeaderValue = Date.now().toString();
    const forwardedFor = '1.2.3.4';
    const forwardedProtocol = 'https';
    const body = {foo: 'bar'};
    const mockOrigin = 'https://example.com:8080/foo/bar?key=value';

    @Controller('/')
    class FooController {
      @POST('/', {})
      get(@Inject(HttpContext) ctx: HttpContext) {
        expect(ctx.request.headers);
        expect(ctx.request.headers[customHeaderKey.toLowerCase()]).toBe(customHeaderValue);
        expect(ctx.request.body).toEqual(body);
        expect(ctx.request.rawBody.toString()).toEqual(JSON.stringify(body));
        expect(ctx.request.hostname).toEqual(expect.any(String));
        expect(ctx.request.method).toEqual(expect.any(String));
        expect(ctx.request.path).toEqual(expect.any(String));
        expect(ctx.request.protocol).toBe(forwardedProtocol);
        expect(ctx.request.address).toBe(forwardedFor);

        ctx.response.statusCode = 200;
        ctx.response.data = {};
        expect(ctx.response.data).toBeInstanceOf(Object);
      }
    }

    const container = new Container();
    container.add(FooController);
    const koaHttpApplicationBuilder = new KoaHttpApplicationBuilder();
    koaHttpApplicationBuilder.addControllerWithMetadata(getHttpControllerMetadata(FooController)!);
    koaHttpApplicationBuilder.setTrustProxy(true).setCorsOption({origin: '*'});

    const koaHttpApplication = koaHttpApplicationBuilder.build(container);

    const testClient = supertest((req: any, res: any) => koaHttpApplication(req, res));
    await testClient
      .post('/')
      .set(customHeaderKey, customHeaderValue)
      .set('x-forwarded-for', `${forwardedFor}, 2.3.4.5`)
      .set('x-forwarded-proto', `${forwardedProtocol}, http`)
      .set('origin', mockOrigin)
      .send(body)
      .expect('access-control-allow-origin', '*')
      .expect(200);
  });

  test('error handling', async () => {
    @Controller('/')
    class FooController {
      @GET('/')
      method() {
        const circular: any = {};
        circular.circular = circular;
        return circular;
      }
    }

    const container = new Container();
    container.add(FooController);
    const koaHttpApplicationBuilder = new KoaHttpApplicationBuilder();
    koaHttpApplicationBuilder.addControllerWithMetadata(getHttpControllerMetadata(FooController)!);
    koaHttpApplicationBuilder.setTrustProxy(true).setCorsOption({origin: '*'});

    const koaHttpApplication = koaHttpApplicationBuilder.build(container);
    const testClient = supertest((req: any, res: any) => koaHttpApplication(req, res));

    const spy = jest.spyOn(console, 'error');
    await testClient.get('/');
    expect(spy).toHaveBeenCalled();
  });

  test('custom param binding', async () => {
    const stubForGet = jest.fn(),
      stubForGetStar = jest.fn(),
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

    const InterceptorA = makeMockInterceptor(stubForA as any, symbolA);
    const InterceptorB = makeMockInterceptor(stubForB as any, symbolB);
    // const InterceptorC = makeMockInterceptor(stubForC, symbolC);

    @Controller('/', {
      interceptProviders: [InterceptorB],
    })
    class FooController {
      unusedMethod() {}

      // @GET('/', {interceptors: [InterceptorC]})
      @GET('/')
      get(
        @Inject(HttpContext) ctx: HttpContext,
        @Inject(symbolA) numberA: number,
        @Inject(symbolB) numberB: number,
        // @Inject(symbolC) numberC: number,
      ) {
        stubForGet(ctx);
      }

      @GET('(.*)')
      getStar(@Inject(HttpContext) ctx: HttpContext, @Query() query: object) {
        stubForGetStar(ctx.request);
        Object.entries(query).forEach(([key, value]) => ctx.response.set(key, value));
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
    container.add(FooController);
    const koaHttpApplicationBuilder = new KoaHttpApplicationBuilder();
    koaHttpApplicationBuilder.addGlobalInterceptProvider(InterceptorA);
    koaHttpApplicationBuilder.addControllerWithMetadata(getHttpControllerMetadata(FooController)!);
    const koaHttpApplication = koaHttpApplicationBuilder.build(container);
    const testClient = supertest((req: any, res: any) => koaHttpApplication(req, res));
    await testClient.get('/any?key=value').then((result) => {
      expect(result.header['key']).toBe('value');
    });
    await testClient.get('/').expect(204);
    await testClient.post('/');
    await testClient.delete('/');
    await testClient.put('/');
    await testClient.patch('/');
    expect(stubForGet).toBeCalledWith(expect.any(KoaHttpContext));
    expect(stubForGetStar).toBeCalledWith(
      expect.objectContaining({
        path: '/any',
        url: '/any?key=value',
        search: '?key=value',
        query: expect.objectContaining({key: 'value'}),
        protocol: 'http',
        hostname: expect.any(String),
      }),
    );
    expect(stubForPost).toBeCalled();
    expect(stubForDelete).toBeCalled();
    expect(stubForPut).toBeCalled();
    expect(stubForPost).toBeCalled();
    expect(stubForPatch).toBeCalled();
    expect(stubForA).toBeCalledWith('before');
    expect(stubForB).toBeCalledWith('before');
    // expect(stubForC).toBeCalledWith('before');
    expect(stubForA).toBeCalledWith('after');
    expect(stubForB).toBeCalledWith('after');
    // expect(stubForC).toBeCalledWith('after');
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
    container.add(FooController);
    const koaHttpApplicationBuilder = new KoaHttpApplicationBuilder();
    const middlewareSpy = jest.fn();
    koaHttpApplicationBuilder.clearMiddleware();
    koaHttpApplicationBuilder.addMiddleware((ctx, next) => {
      middlewareSpy();
      return next();
    });
    koaHttpApplicationBuilder.addControllerWithMetadata(getHttpControllerMetadata(FooController)!);
    const koaHttpApplication = koaHttpApplicationBuilder.build(container);
    const testClient = supertest((req: any, res: any) => koaHttpApplication(req, res));

    await testClient
      .post('/foo/' + timestamp + '?timestamp=' + timestamp)
      .set('x-timestamp', timestamp.toString())
      .send({timestamp});
    expect(controllerSpy).toHaveBeenCalled();
    expect(middlewareSpy).toHaveBeenCalled();
  });
});
