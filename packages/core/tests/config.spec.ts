import {Component, ConfigProvider, InjectConfig, ModuleClass, ModuleRoot, OnModuleCreate} from '../src';

test('InjectConfig', async () => {
  @Component()
  class MockInjectProvider extends ConfigProvider {
    get(name: string): unknown {
      return 'mocked';
    }
  }

  @ModuleClass({
    components: [MockInjectProvider],
  })
  class ConfigTestModule {
    test(
      @InjectConfig('a') a: string,
      @InjectConfig('b', {transform: (x: any) => x.toString().toUpperCase()}) b: string,
    ) {
      expect(a).toBe('mocked');
      expect(b).toBe('MOCKED');
    }
  }
  await ModuleRoot.run(ConfigTestModule, 'test');
});
