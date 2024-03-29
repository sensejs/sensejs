import {jest} from '@jest/globals';
import {
  createConnectionFactory,
  Module,
  EntryModule,
  provideConnectionFactory,
  provideOptionInjector,
  Inject,
  OnModuleCreate,
  OnModuleDestroy,
} from '../src/index.js';

test('createConnectionFactory', async () => {
  interface Option {
    foo: string;
  }

  const stub = jest.fn();

  class MockConn {
    constructor(public readonly option: Option) {
      stub(option);
    }

    async close() {}
  }

  jest.spyOn(MockConn.prototype, 'close');

  const factoryProvider = provideConnectionFactory<MockConn, Option>(
    async (option) => new MockConn(option),
    async (conn) => conn.close(),
    MockConn,
  );

  const foo = `foo_${Date.now()}`;

  @Module({factories: [factoryProvider]})
  class MyFactoryModule {
    constructor(@Inject(factoryProvider.factory) private factory: InstanceType<typeof factoryProvider.factory>) {}

    @OnModuleCreate()
    async onCreate() {
      await this.factory.connect({foo});
    }

    @OnModuleDestroy()
    async onDestroy() {
      return this.factory.disconnect();
    }
  }

  @Module({requires: [MyFactoryModule]})
  class MyModule {
    constructor(@Inject(MockConn) conn: MockConn) {}
  }

  const moduleRoot = new EntryModule(MyModule);
  await moduleRoot.bootstrap();
  expect(stub).toHaveBeenCalled();
  await moduleRoot.shutdown();
  expect(MockConn.prototype.close).toHaveBeenCalled();
});

test('createConfigHelperFactory', async () => {
  interface Foo {
    foo: {
      x: string;
      y: string;
    };
    bar: boolean;
  }

  const defaultValue = {
    foo: {
      x: 'foo.x',
    },
  };
  const injectSymbol = Symbol();

  const merger = (defaulted?: typeof defaultValue, injected?: Partial<Foo>): Foo => {
    // Common way to merge option
    const {bar} = Object.assign({}, defaulted, injected);
    const foo = Object.assign({}, defaulted?.foo, injected?.foo);
    const {x, y = undefined} = foo;
    if (typeof x !== 'string' || typeof y !== 'string' || typeof bar !== 'boolean') {
      throw new TypeError();
    }
    return {foo: {x, y}, bar};
  };

  const optionProvider = provideOptionInjector<Foo, typeof defaultValue>(defaultValue, injectSymbol, merger);
  const factories = [optionProvider];

  @Module({
    constants: [{provide: injectSymbol, value: {foo: {y: 'x'}, bar: false}}],
    factories,
  })
  class CorrectModule {
    constructor(@Inject(optionProvider.provide) private factory: Foo) {}
  }

  await new EntryModule(CorrectModule).start();

  @Module({
    constants: [{provide: injectSymbol, value: {foo: {x: 'x'}}}],
    factories,
  })
  class BuggyModule {
    constructor(@Inject(optionProvider.provide) private factory: Foo) {}
  }

  await expect(new EntryModule(BuggyModule).start()).rejects.toBeInstanceOf(TypeError);
});
