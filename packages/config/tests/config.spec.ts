import {ModuleRoot} from '@sensejs/core';
import {ConfigModule} from '../src';
import {inject} from 'inversify';

describe('ConfigModule', () => {
  test('circurlar dependency', () => {
    const config: any = {};
    config.config = config;
    expect(() => ConfigModule({config, prefix: '$'})).toThrow();
  });

  test('inject config', async () => {
    const nestedInArray = 3;
    const root = {
      object: {foo: 'bar'},
      array: [1, 2, {deepNested: nestedInArray}],
      others: true,
    };

    const spy = jest.fn();

    class MyModule extends ConfigModule({config: root, prefix: 'config'}) {
      constructor(
        @inject('config') config: object,
        @inject('config.object.foo') nestedObject: string,
        @inject('config.array.1') arrayElement: number,
        @inject('config.array.2.deepNested') deepNested: object,
      ) {
        super();
        expect(config).toBe(root);
        expect(nestedObject).toBe(root.object.foo);
        expect(arrayElement).toBe(root.array[1]);
        expect(deepNested).toBe(nestedInArray);
        spy();
      }
    }

    await new ModuleRoot(MyModule).start();
    expect(spy).toHaveBeenCalled();
  });
});
