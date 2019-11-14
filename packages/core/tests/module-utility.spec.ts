import {ComponentScope, createConfigHelperFactory, createConnectionFactory, Module, ModuleRoot} from '../src';
import {inject} from 'inversify';

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

  const Factory = createConnectionFactory<MockConn, Option>(
    async (option) => new MockConn(option),
    async (conn) => conn.close(),
  );

  const foo = `foo_${Date.now()}`;

  class MyFactoryModule extends Module({
    factories: [{provide: MockConn, factory: Factory, scope: ComponentScope.SINGLETON}],
  }) {
    constructor(@inject(Factory) private factory: InstanceType<typeof Factory>) {
      super();
    }

    async onCreate() {
      await this.factory.connect({foo});
    }

    async onDestroy() {
      return this.factory.disconnect();
    }
  }

  class MyModule extends Module({
    requires: [MyFactoryModule],
  }) {
    constructor(@inject(MockConn) conn: MockConn) {
      super();
    }
  }

  const moduleRoot = new ModuleRoot(MyModule);
  await moduleRoot.start();
  expect(stub).toHaveBeenCalled();
  await moduleRoot.stop();
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

  const ConfigFactory = createConfigHelperFactory<Foo, typeof defaultValue>(defaultValue, injectSymbol, merger);
  const configSymbol = Symbol();
  const factories = [{provide: configSymbol, factory: ConfigFactory, scope: ComponentScope.SINGLETON}];

  class CorrectModule extends Module({
    constants: [{provide: injectSymbol, value: {foo: {y: 'x'}, bar: false}}],
    factories,
  }) {
    constructor(@inject(configSymbol) private factory: Foo) {
      super();
    }
  }

  await new ModuleRoot(CorrectModule).start();

  class BuggyModule extends Module({
    constants: [{provide: injectSymbol, value: {foo: {x: 'x'}}}],
    factories,
  }) {
    constructor(@inject(configSymbol) private factory: Foo) {
      super();
    }
  }

  await expect(new ModuleRoot(BuggyModule).start()).rejects.toBeInstanceOf(TypeError);
});
