import {ComponentScope, createConnectionFactory, Module, ModuleRoot} from '../src';
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
