import 'reflect-metadata';
import {Body, Controller, DELETE, GET, Header, PATCH, Path, POST, PUT, Query} from '../src/http-decorators';
import supertest from 'supertest';
import {KoaHttpApplicationBuilder, KoaHttpContext} from '../src/http-koa-integration';
import {Container} from 'inversify';
import {ParamBinding} from '../src/param-binding';
import {AbstractHttpInterceptor, HttpContext} from '../src/http-abstract';

describe('KoaHttpApplicationBuilder', () => {

    test('param binding', async () => {

        const stubForGet = jest.fn(),
            stubForPost = jest.fn(),
            stubForDelete = jest.fn(),
            stubForPatch = jest.fn(),
            stubForPut = jest.fn();
        const stubForA = jest.fn();
        const symbol = Symbol();

        class InterceptorA extends AbstractHttpInterceptor {
            intercept(context: HttpContext, next: () => Promise<void>): Promise<void> {
                stubForA();
                context.bindContextValue(symbol, Math.random());
                return next();
            }
        }

        @Controller('/', {
            interceptors: [InterceptorA]
        })
        class FooController {

            @GET('/')
            get(@ParamBinding(HttpContext) ctx: HttpContext,
                @ParamBinding(symbol) number: number) {
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
        const koaHttpApplicationBuilder = new KoaHttpApplicationBuilder(container);
        koaHttpApplicationBuilder.addController(FooController);
        const koaHttpApplication = koaHttpApplicationBuilder.build();
        const testClient = supertest((req, res) => koaHttpApplication(req, res));
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
        expect(stubForA).toBeCalled();

    });

    test('', async () => {
        const timestamp = Date.now().toString();
        const stub = jest.fn();

        @Controller('/foo')
        class FooController {


            @POST('/:path')
            post(@Body() httpBody: object,
                 @Path('path') urlPath: string,
                 @Query() httpQuery: object,
                 @Header('x-timestamp') customHeader: string
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
        const testClient = supertest((req, res) => koaHttpApplication(req, res));

        await testClient.post('/foo/' + timestamp + '?timestamp=' + timestamp)
            .set('x-timestamp', timestamp.toString())
            .send({timestamp});
        expect(stub).toHaveBeenCalled();
    });
});
