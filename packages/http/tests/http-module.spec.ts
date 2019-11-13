import {ApplicationFactory, Component, Module} from '@sensejs/core';
import {inject, Container} from 'inversify';
import supertest from 'supertest';
import {Controller, GET, HttpModule, HttpConfigType} from '../src';

describe('HttpModule', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });
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
      type: HttpConfigType.static,
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

  test('could access http server with identifier', async () => {
    const stub = jest.fn();
    const serverIdentifier = Symbol();

    const MyHttpModule = HttpModule({
      serverIdentifier,
      type: HttpConfigType.static,
      staticHttpConfig: {
        listenPort: 3000,
        listenAddress: '0.0.0.0',
      },
    });

    const server = {
      close: jest.fn().mockImplementation((done) => done()),
    };

    jest.spyOn(MyHttpModule.prototype, 'createHttpServer').mockImplementation(() => {
      stub();
      return server;
    });

    class TestModule extends Module({requires: [MyHttpModule]}) {
      constructor(@inject(Container) private container: Container) {
        super();
      }
      async onCreate() {
        const containerServer = this.container.get(serverIdentifier);
        expect(containerServer).toBe(server);
      }
    }

    const app = new ApplicationFactory(TestModule);
    await app.start();
    await app.stop();

    expect(stub).toBeCalled();
    expect(server.close).toBeCalled();
  });
});
