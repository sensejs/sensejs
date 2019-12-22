import {ModuleClass, ModuleRoot} from '@sensejs/core';
import {createConfigModule} from '../src';
import {inject} from 'inversify';

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

    @ModuleClass({requires: [createConfigModule({config: root, prefix: 'config'})]})
    class MyModule {
      constructor(
        @inject('config') config: object,
        @inject('config.object.foo') nestedObject: string,
        @inject('config.array.1') arrayElement: number,
        @inject('config.array.2.deepNested') deepNested: object,
        @inject('config.\\\\fancy\\.name.key') fancyConfig: boolean,
      ) {
        expect(config).toBe(root);
        expect(nestedObject).toBe(root.object.foo);
        expect(arrayElement).toBe(root.array[1]);
        expect(deepNested).toBe(nestedInArray);
        expect(fancyConfig).toBe(root[fancyConfigName].key);
        spy();
      }
    }

    await new ModuleRoot(MyModule).start();
    expect(spy).toHaveBeenCalled();
  });
});
