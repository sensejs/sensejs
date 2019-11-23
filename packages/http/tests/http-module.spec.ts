import {ModuleRoot, Component, Module} from '@sensejs/core';
import {inject, Container} from 'inversify';
import supertest from 'supertest';
import {Controller, GET, HttpModule, HttpConfigType} from '../src';
import {Server} from 'http';

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
      httpOption: {
        listenPort: 3000,
        listenAddress: '0.0.0.0',
      },
    });

    const app = new ModuleRoot(MyHttpModule);
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
      httpOption: {
        listenPort: 0,
        listenAddress: '0.0.0.0',
      },
    });
    //
    // const server = {
    //   close: jest.fn().mockImplementation((done) => done()),
    // };

    // jest.spyOn(MyHttpModule.prototype, 'createHttpServer').mockImplementation(() => {
    //   stub();
    //   return server;
    // });

    class TestModule extends Module({requires: [MyHttpModule]}) {
      constructor(@inject(Container) private container: Container) {
        super();
      }
      async onCreate() {
        const containerServer = this.container.get(serverIdentifier);
        stub(containerServer);
        expect(containerServer).toBeInstanceOf(Server);
      }
    }

    const app = new ModuleRoot(TestModule);
    await app.start();
    await app.stop();

    expect(stub).toBeCalledWith(expect.any(Server));
  });
});
