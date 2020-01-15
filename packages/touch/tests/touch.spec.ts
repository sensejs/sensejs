import {Body, GET, Header, Path, POST, Query} from '@sensejs/http-common';
import {Component, Inject, ModuleClass, ModuleRoot, OnModuleCreate} from '@sensejs/core';
import {Container} from 'inversify';
import {
  AbstractTouchAdaptor,
  createTouchModule,
  IRequestMetadata,
  ITouchAdaptorBuilder,
  ITouchClientOptions,
  TouchBuilderSymbol,
  TouchClient,
} from '../src';
import {Decorator} from '@sensejs/utility';

const mockTouchAdaptor: AbstractTouchAdaptor = {
  post: jest.fn(),
  get: jest.fn(),
  head: jest.fn(),
  options: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
};

class MockAdaptorBuilder implements ITouchAdaptorBuilder {
  build() {
    return mockTouchAdaptor;
  }
}

const mockTouchAdaptorConstant = {provide: TouchBuilderSymbol, value: new MockAdaptorBuilder()};

const testPath: { [key in keyof AbstractTouchAdaptor]: string } = {
  post: '/post',
  get: '/get',
  head: '/head',
  options: '/options',
  put: '/put',
  delete: '/delete',
  patch: '/patch',
};

const testQuery = {a: '1'};
const testQuery1 = {aa: 'aa'};
const testBody = {b: '2'};
const testHeader = {c: '3'};
const testPathA = {a: 'aValue'};
const testPathB = {b: 'bValue'};

describe('Test @TouchClient', () => {
  test('general usage', async () => {
    @TouchClient()
    class MyTouchClientService {
      @POST(testPath.post)
      testReturn() {
        return Promise.resolve();
      }

      @GET(testPath.get)
      testThrow() {
        return Promise.resolve();
      }
    }

    const mockValue = 1;
    const mockError = new Error('mock');

    const testReturnSpy = jest.spyOn(mockTouchAdaptor, 'post').mockResolvedValue(mockValue);
    const testThrowSpy = jest.spyOn(mockTouchAdaptor, 'get').mockRejectedValue(mockError);
    const spy = jest.fn();

    @ModuleClass({
      requires: [createTouchModule({clients: MyTouchClientService})],
      constants: [mockTouchAdaptorConstant],
    })
    class TestModule {
      constructor(@Inject(Container) private container: Container) {}

      @OnModuleCreate()
      async onCreate() {
        const touchClient = this.container.get(MyTouchClientService);
        const result = await touchClient.testReturn();
        expect(result).toBe(mockValue);

        spy();

        try {
          await touchClient.testThrow();
        } catch (error) {
          spy();
        }
      }
    }

    const app = new ModuleRoot(TestModule);
    await app.start();
    await app.stop();

    expect(spy).toBeCalledTimes(2);

    expect(testReturnSpy).toBeCalled();
    expect(testReturnSpy).toBeCalledWith(testPath.post, expect.any(Object));

    expect(testThrowSpy).toBeCalled();
    expect(testThrowSpy).toBeCalledWith(testPath.get, expect.any(Object));

    testReturnSpy.mockRestore();
    testThrowSpy.mockRestore();
  });

  interface IArgsTestUnit {
    name: string;
    decorators: Decorator[];
    invokeArgs: any[];
    expectArg: IRequestMetadata;
  }

  const argsTestUnits: IArgsTestUnit[] = [
    {
      name: 'use with arg object',
      decorators: [Query(), Body(), Header()],
      invokeArgs: [testQuery, testBody, testHeader],
      expectArg: {body: testBody, query: testQuery, headers: testHeader},
    },
    {
      name: 'use with single arg',
      decorators: [Query('a'), Body('b'), Header('c')],
      invokeArgs: [testQuery.a, testBody.b, testHeader.c],
      expectArg: {body: testBody, query: testQuery, headers: testHeader},
    },
    {
      name: 'use with arg object assign',
      decorators: [Query(), Query()],
      invokeArgs: [testQuery, testQuery1],
      expectArg: {body: {}, query: Object.assign({}, testQuery, testQuery1), headers: {}},
    },
    {
      name: 'use with single arg assign',
      decorators: [Query('a'), Query('aa')],
      invokeArgs: [testQuery.a, testQuery1.aa],
      expectArg: {body: {}, query: Object.assign({}, testQuery, testQuery1), headers: {}},
    },
  ];

  for (const {decorators, expectArg, invokeArgs, name} of argsTestUnits) {
    test(name, async () => {
      @TouchClient()
      class MyTouchClientService {
        @POST(testPath.post)
        post(...args: any[]) {}
      }

      decorators.forEach((decorator, index) => {
        decorator(MyTouchClientService.prototype, 'post', index);
      });

      @ModuleClass({
        requires: [createTouchModule({clients: MyTouchClientService})],
        constants: [mockTouchAdaptorConstant],
      })
      class TestModule {
        constructor(@Inject(Container) private container: Container) {}

        @OnModuleCreate()
        onCreate() {
          const touchClient = this.container.get(MyTouchClientService);
          touchClient.post(...invokeArgs);
        }
      }

      const app = new ModuleRoot(TestModule);
      await app.start();
      await app.stop();

      expect(mockTouchAdaptor.post).toBeCalled();
      expect(mockTouchAdaptor.post).toBeCalledWith(testPath.post, expect.objectContaining(expectArg));
    });
  }

  interface IPathTestUnit {
    name: string;
    decorators: Decorator[];
    invokeArgs: any[];
    path: string;
    expectPath: string;
  }

  const pathTestUnits: IPathTestUnit[] = [
    {
      name: 'single path param',
      decorators: [Path('a')],
      path: '/{a}',
      invokeArgs: [testPathA.a],
      expectPath: '/aValue',
    },
    {
      name: 'path param object',
      decorators: [Path()],
      path: '/{a}/{b}',
      invokeArgs: [Object.assign({}, testPathA, testPathB)],
      expectPath: '/aValue/bValue',
    },
    {
      name: 'multi single path param',
      decorators: [Path('a'), Path('b')],
      path: '/{a}/{b}',
      invokeArgs: [testPathA.a, testPathB.b],
      expectPath: '/aValue/bValue',
    },
    {
      name: 'multi path param object',
      decorators: [Path(), Path()],
      path: '/{a}/{b}',
      invokeArgs: [testPathA, testPathB],
      expectPath: '/aValue/bValue',
    },
  ];

  for (const {name, decorators, path, invokeArgs, expectPath} of pathTestUnits) {
    test(name, async () => {
      @TouchClient()
      class MyTouchClientService {
        @POST(path)
        post(...args: any[]) {}
      }

      decorators.forEach((decorator, index) => {
        decorator(MyTouchClientService.prototype, 'post', index);
      });

      @ModuleClass({
        requires: [createTouchModule({clients: MyTouchClientService})],
        constants: [mockTouchAdaptorConstant],
      })
      class TestModule {
        constructor(@Inject(Container) private container: Container) {}

        @OnModuleCreate()
        onCreate() {
          const touchClient = this.container.get(MyTouchClientService);
          touchClient.post(...invokeArgs);
        }
      }

      const app = new ModuleRoot(TestModule);
      await app.start();
      await app.stop();

      expect(mockTouchAdaptor.post).toBeCalled();
      expect(mockTouchAdaptor.post).toBeCalledWith(expectPath, expect.any(Object));
    });
  }

  test('throw error without @TouchClient decorated', () => {
    class WillThrowWithoutTouchClient {}

    expect(() => createTouchModule({clients: WillThrowWithoutTouchClient})).toThrow();
  });

  test('options', async () => {
    const globalOptions: ITouchClientOptions = {
      retry: 10,
      baseUrl: 'http://test-url',
    };
    const spy = jest.fn();
    const adaptorSpy = jest.fn();
    const mockPost = jest.spyOn(mockTouchAdaptor, 'post').mockRejectedValue(null);

    @TouchClient()
    class MyTouchClientService {
      @POST('/')
      post() {
        return Promise.resolve();
      }
    }

    @Component()
    class MockAdaptorBuilder implements ITouchAdaptorBuilder {
      build(option: any) {
        adaptorSpy(option);
        return mockTouchAdaptor;
      }
    }

    @ModuleClass({
      requires: [createTouchModule(Object.assign({clients: MyTouchClientService}, globalOptions))],
      constants: [{provide: TouchBuilderSymbol, value: new MockAdaptorBuilder()}],
    })
    class TestModule {
      constructor(@Inject(Container) private container: Container) {}

      @OnModuleCreate()
      async onCreate() {
        const touchClient = this.container.get(MyTouchClientService);
        try {
          await touchClient.post();
        } catch (error) {
          spy();
        }
      }
    }

    const app = new ModuleRoot(TestModule);
    await app.start();
    await app.stop();

    expect(spy).toBeCalled();
    expect(adaptorSpy).toBeCalledWith(expect.objectContaining(globalOptions));
    expect(mockTouchAdaptor.post).toBeCalledTimes(globalOptions.retry!);
    mockPost.mockReset();
  });

  test('options merge order', async () => {
    const globalOptions: ITouchClientOptions = {
      retry: 10,
      baseUrl: 'http://global-url/',
    };
    const clientOptions: ITouchClientOptions = {
      retry: 11,
      baseUrl: 'http://clients-url',
    };
    const assignedOptions = Object.assign({}, globalOptions, clientOptions);
    const spy = jest.fn();
    const adaptorSpy = jest.fn();
    const mockPost = jest.spyOn(mockTouchAdaptor, 'post').mockRejectedValue(null);

    @TouchClient(clientOptions)
    class MyTouchClientService {
      @POST('/')
      post() {
        return Promise.resolve();
      }
    }

    @Component()
    class MockAdaptorBuilder implements ITouchAdaptorBuilder {
      build(option: any) {
        adaptorSpy(option);
        return mockTouchAdaptor;
      }
    }

    @ModuleClass({
      requires: [createTouchModule(Object.assign({clients: MyTouchClientService}, globalOptions))],
      constants: [{provide: TouchBuilderSymbol, value: new MockAdaptorBuilder()}],
    })
    class TestModule {
      constructor(@Inject(Container) private container: Container) {}

      @OnModuleCreate()
      async onCreate() {
        const touchClient = this.container.get(MyTouchClientService);
        try {
          await touchClient.post();
        } catch (error) {
          spy();
        }
      }
    }

    const app = new ModuleRoot(TestModule);
    await app.start();
    await app.stop();

    expect(spy).toBeCalled();
    expect(adaptorSpy).toBeCalledWith(expect.objectContaining(assignedOptions));
    expect(mockTouchAdaptor.post).toBeCalledTimes(assignedOptions.retry!);
    mockPost.mockReset();
  });

  test('multi touch clients', async () => {
    @TouchClient()
    class TouchClient1 {
      @POST(testPath.post)
      post() {
        return Promise.resolve();
      }
    }

    @TouchClient()
    class TouchClient2 {
      @GET(testPath.get)
      get() {
        return Promise.resolve();
      }
    }

    const spy = jest.fn();

    @ModuleClass({
      requires: [createTouchModule({clients: [TouchClient1, TouchClient2]})],
      constants: [mockTouchAdaptorConstant],
    })
    class TestModule {
      constructor(@Inject(Container) private container: Container) {}

      @OnModuleCreate()
      async onCreate() {
        const touchClient1 = this.container.get(TouchClient1);
        const touchClient2 = this.container.get(TouchClient2);
        await touchClient1.post();
        await touchClient2.get();

        spy();
      }
    }

    const app = new ModuleRoot(TestModule);
    await app.start();
    await app.stop();

    expect(mockTouchAdaptor.post).toBeCalled();
    expect(mockTouchAdaptor.get).toBeCalled();
  });
});
