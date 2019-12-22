import {Component, Module, ModuleRoot, ModuleClass, OnModuleCreate} from '@sensejs/core';
import {Container, inject} from 'inversify';
import supertest from 'supertest';
import {Controller, GET, HttpContext, HttpInterceptor, HttpModule, createHttpModule} from '../src';
import {Server} from 'http';

describe('HttpModule', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });
  test('basic usage', async () => {
    const stub = jest.fn();

    class MockInterceptor extends HttpInterceptor {
      intercept(context: HttpContext, next: () => Promise<void>): Promise<void> {
        return next();
      }
    }

    @Component()
    class MyComponent {
      foo() {
        stub();
        return 'foo';
      }
    }

    @Controller('/foo', {interceptors: [MockInterceptor]})
    class FooController {
      constructor(@inject(MyComponent) private myComponent: MyComponent) {}

      @GET('/')
      handleRequest() {
        return this.myComponent.foo();
      }
    }

    const app = new ModuleRoot(createHttpModule({
      components: [MyComponent, FooController],
      httpOption: {
        listenPort: 3000,
        listenAddress: '0.0.0.0',
      },
    }));
    await app.start();
    await supertest('http://localhost:3000').get('/foo');
    expect(stub).toHaveBeenCalled();
    await app.stop();
  });

  test('could access http server with identifier', async () => {
    const stub = jest.fn();
    const serverIdentifier = Symbol();

    const myHttpModule = createHttpModule({
      serverIdentifier,
      httpOption: {
        listenPort: 0,
        listenAddress: '0.0.0.0',
      },
    });

    @ModuleClass({requires: [myHttpModule]})
    class TestModule {
      constructor(@inject(Container) private container: Container) {
      }

      @OnModuleCreate()
      async onCreate() {
        const containerServer = this.container.get(serverIdentifier);
        stub(containerServer);
      }
    }

    const app = new ModuleRoot(TestModule);
    await app.start();
    await app.stop();

    expect(stub).toBeCalledWith(expect.any(Server));
  });
});
