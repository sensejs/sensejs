import {Component, Inject, createModule} from '@sensejs/core';
import {inject} from 'inversify';
import supertest from 'supertest';
import {Controller, createHttpModule, GET, HttpContext, HttpInterceptor} from '../src';
import {Server} from 'http';
import {ApplicationRunner} from '@sensejs/core/lib/entry-point';
import {ProcessManager} from '@sensejs/core/lib/builtin-module';

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
    bar() {}
  }

  @Controller('/foo', {interceptors: [MockInterceptor], label: ['foo']})
  class FooController {
    constructor(@inject(MyComponent) private myComponent: MyComponent) {}

    @GET('/')
    handleRequest() {
      return this.myComponent.foo();
    }
  }

  const runPromise = ApplicationRunner.runModule(createHttpModule({
    requires: [createModule({components: [MyComponent, FooController]})],
    serverIdentifier,
    matchLabel: ['foo'],
    httpOption: {
      listenPort: 3000,
      listenAddress: '0.0.0.0',
    },
  }), {
    onExit: () => {
      return undefined as never;
    },
  });
  await runPromise;
  await supertest('http://localhost:3000').get('/bar').expect(404);
  await supertest('http://localhost:3000').get('/foo').expect(200);
});
