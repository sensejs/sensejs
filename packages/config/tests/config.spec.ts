import {jest} from '@jest/globals';
import {EntryModule, Inject, Module} from '@sensejs/core';
import {Config, createConfigModule, createStaticConfigModule, MissingConfigError} from '../src/index.js';

describe('ConfigModule', () => {
  test('circurlar dependency', () => {
    const config: any = {};
    config.config = config;
    expect(() => createConfigModule({config, prefix: '$'})).toThrow();
  });

  test('inject config', async () => {
    const nestedInArray = 3;
    const fancyConfigName = '\\fancy.name';
    const root = {
      object: {foo: 'bar'},
      array: [1, 2, {deepNested: nestedInArray}],
      others: true,
      [fancyConfigName]: {
        key: 'value',
      },
    };

    const spy = jest.fn();

    @Module({requires: [createConfigModule({config: root, prefix: 'config'})]})
    class MyModule {
      constructor(
        @Inject('config') config: object,
        @Inject('config.object.foo') nestedObject: string,
        @Inject('config.array.1') arrayElement: number,
        @Inject('config.array.2.deepNested') deepNested: object,
        @Inject('config.\\\\fancy\\.name.key') fancyConfig: boolean,
      ) {
        expect(config).toBe(root);
        expect(nestedObject).toBe(root.object.foo);
        expect(arrayElement).toBe(root.array[1]);
        expect(deepNested).toBe(nestedInArray);
        expect(fancyConfig).toBe(root[fancyConfigName].key);
        spy();
      }
    }

    await new EntryModule(MyModule).start();
    expect(spy).toHaveBeenCalled();
  });
});

test('InjectConfig', async () => {
  const staticConfig = {
    a: 'a',
    b: 'b',
  };
  @Module({
    requires: [createStaticConfigModule(staticConfig)],
  })
  class A {
    constructor(@Config('a') a: unknown) {}

    test(@Config('b') b: unknown) {}

    missingConfig(@Config('missingKey') missingConfig: unknown) {}
  }

  await EntryModule.run(A, 'test');
  await expect(() => EntryModule.run(A, 'missingConfig')).rejects.toThrow(MissingConfigError);
});
