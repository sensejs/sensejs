import 'reflect-metadata';
import {HttpModule} from '../src/http-module';
import {Controller, GET} from '../src/http-decorators';
import {inject} from 'inversify';
import supertest from 'supertest';
import {ApplicationFactory, Component} from '@sensejs/core';

describe('HttpModule', () => {
  test('basic usage', async () => {
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
      constructor(@inject(MyComponent) private myComponent: MyComponent) {}

      @GET('/')
      handleRequest() {
        return this.myComponent.foo();
      }
    }

    const MyHttpModule = HttpModule({
      components: [MyComponent, FooController],
      type: 'static',
      staticHttpConfig: {
        listenPort: 3000,
        listenAddress: '0.0.0.0',
      },
    });

    const app = new ApplicationFactory(MyHttpModule);
    await app.start();
    await supertest('http://localhost:3000').get('/foo');
    expect(stub).toHaveBeenCalled();
    await app.stop();
  });
});
