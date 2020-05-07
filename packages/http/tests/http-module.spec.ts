import {ApplicationRunner, Component, createModule, Inject, ModuleClass, OnModuleCreate, ProcessManager} from '@sensejs/core';
import {inject} from 'inversify';
import supertest from 'supertest';
import {
  Controller,
  createHttpModule,
  GET,
  HttpContext,
  HttpInterceptor,
  KoaHttpApplicationBuilder,
  Query,
} from '../src';
import {Server} from 'http';
import {AddressInfo} from 'net';

test('HttpModule', async () => {
  const serverIdentifier = Symbol();

  class MockInterceptor extends HttpInterceptor {
    intercept(context: HttpContext, next: () => Promise<void>): Promise<void> {
      return next();
    }
  }

  @Component()
  class MyComponent {
    constructor(
      @Inject(ProcessManager) private processManager: ProcessManager,
      @Inject(serverIdentifier) private httpServer: unknown,
    ) {}

    foo() {
      expect(this.httpServer).toBeInstanceOf(Server);
      this.processManager.shutdown();
      return 'foo';
    }
  }

  @Controller('/bar')
  class BarController {
    @GET('/')
    bar() {
    }
  }

  @Controller('/foo', {interceptors: [MockInterceptor], label: ['foo']})
  class FooController {
    constructor(@inject(MyComponent) private myComponent: MyComponent) {}

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
      createHttpModule({
        httpAdaptorFactory: () => {
          return new KoaHttpApplicationBuilder()
            .setKoaBodyParserOption({})
            .setQueryStringParsingMode('extended');
        },
        requires: [createModule({components: [MyComponent, FooController]})],
        serverIdentifier,
        matchLabel: ['foo'],
        httpOption: {
          listenPort: 0,
          listenAddress: '0.0.0.0',
          corsOption: {},
        },
      }),
    ],

  })
  class Module {

    @OnModuleCreate()
    async onModuleCreate(@Inject(serverIdentifier) server: Server) {
      const port = (
        server.address() as AddressInfo
      ).port;
      const baseUrl = `http://localhost:${port}`;
      await supertest(baseUrl).get('/bar').expect(404);
      const {body} = await supertest(baseUrl)
        .get('/foo/bar?object%5bproperty%5d=value&array%5b%5d=1&array%5b%5d=2');
      expect(body).toEqual(expect.objectContaining({
        object: expect.objectContaining({
          property: 'value',
        }),
        array: ['1', '2'],
      }));
      await supertest(baseUrl).get('/foo').expect(200);
    }

  }

  const runPromise = ApplicationRunner.runModule(Module, {
    onExit: () => {
      return undefined as never;
    },
  });
  await runPromise;
});
