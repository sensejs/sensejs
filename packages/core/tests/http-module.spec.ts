import 'reflect-metadata';
import {HttpModule} from '../src/http-module';
import {Controller, GET} from '../src/http-decorators';
import {Component} from '../src/component';
import {inject} from 'inversify';
import {KoaHttpApplicationBuilder} from '../src/http-koa-integration';
import {ApplicationFactory} from '../src/application-factory';
import supertest from 'supertest';


describe('HttpModule', () => {

    test('', async () => {

        const stub = jest.fn();

        @Component()
        class MyComponent {
            foo() {
                stub();
                return 'foo';
            }
        }

        @Controller('/foo')
        class FooController {
            constructor(@inject(MyComponent) private myComponent: MyComponent) {
            }

            @GET('/bar')
            handleRequest() {
                return this.myComponent.foo();
            }
        }

        @HttpModule({
            components: [MyComponent, FooController],
            type: 'static',
            staticHttpConfig: {
                listenPort: 3000,
                listenAddress: '0.0.0.0'

            },
            httpApplicationBuilder: KoaHttpApplicationBuilder
        })
        class MyHttpModule {
        }

        const app = new ApplicationFactory(MyHttpModule);
        await app.start();
        await supertest('http://localhost:3000').get('/foo/bar');
        expect(stub).toHaveBeenCalled();
        await app.stop();


    });
});
