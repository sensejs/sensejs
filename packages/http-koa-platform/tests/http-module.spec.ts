import {createKoaHttpModule} from '../src/index.js';
import {Component, createModule, Inject, ModuleClass, ModuleRoot, ProcessManager} from '@sensejs/core';
import supertest from 'supertest';
import {Server} from 'http';
import {AddressInfo} from 'net';
import {Controller, GET, Query} from '@sensejs/http-common';
import {InterceptProviderClass} from '@sensejs/container';

test('HttpModule', async () => {
  const serverIdentifier = Symbol();

  @InterceptProviderClass()
  class MockInterceptor {
    intercept(next: () => Promise<void>): Promise<void> {
      return next();
    }
  }

  @Component()
  class MyComponent {
    constructor(@Inject(ProcessManager) private processManager: ProcessManager) {}

    foo() {
      this.processManager.shutdown();
      return 'foo';
    }
  }

  @Controller('/bar')
  class BarController {
    @GET('/')
    bar() {}
  }

  @Controller('/foo', {interceptProviders: [MockInterceptor], labels: ['foo']})
  class FooController {
    constructor(@Inject(MyComponent) private myComponent: MyComponent) {}

    @GET('/')
    handleRequest() {
      return this.myComponent.foo();
    }

    @GET('/bar')
    queryTest(@Query() query: unknown) {
      return query;
    }
  }

  @ModuleClass({
    requires: [
      createKoaHttpModule({
        requires: [createModule({components: [MyComponent, FooController]})],
        serverIdentifier,
        matchLabels: ['foo'],
        httpOption: {
          listenPort: 0,
          listenAddress: '0.0.0.0',
          corsOption: {},
          queryStringParsingMode: 'extended',
        },
      }),
    ],
  })
  class Module {
    async test(@Inject(serverIdentifier) server: Server, @Inject(ProcessManager) pm: ProcessManager) {
      const port = (server.address() as AddressInfo).port;
      const baseUrl = `http://localhost:${port}`;
      await supertest(baseUrl).get('/bar').expect(404);
      const {body} = await supertest(baseUrl).get('/foo/bar?object%5bproperty%5d=value&array%5b%5d=1&array%5b%5d=2');
      expect(body).toEqual(
        expect.objectContaining({
          object: expect.objectContaining({
            property: 'value',
          }),
          array: ['1', '2'],
        }),
      );
      await supertest(baseUrl).get('/foo').expect(200);
      pm.shutdown();
    }
  }

  return await ModuleRoot.start(Module, 'test');
});
