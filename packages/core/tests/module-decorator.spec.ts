import {
  createModule,
  getModuleMetadata,
  ModuleClass,
  OnModuleCreate,
  OnModuleDestroy,
  OnModuleStart,
  OnModuleStop,
} from '../src/index.js';

describe('@ModuleClass', () => {
  test('created module metadata', () => {
    const dependency = createModule();
    const key = Symbol();
    expect(
      getModuleMetadata(
        createModule({
          requires: [dependency],
          properties: {
            [key]: 'value',
          },
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        requires: [dependency],
        onModuleCreate: [],
        onModuleDestroy: [],
        properties: expect.objectContaining({
          [key]: 'value',
        }),
      }),
    );
  });

  test('decorated module metadata', () => {
    @ModuleClass()
    class Y {}

    @ModuleClass({
      requires: [Y],
    })
    class X {
      @OnModuleCreate()
      foo() {}

      @OnModuleCreate()
      onModuleCreate() {}

      @OnModuleStart()
      onModuleStart() {}

      @OnModuleStop()
      onModuleStop() {}

      @OnModuleDestroy()
      bar() {}

      @OnModuleDestroy()
      onModuleDestroy() {}
    }

    expect(getModuleMetadata(X)).toEqual(
      expect.objectContaining({
        requires: [Y],
        onModuleCreate: ['foo', 'onModuleCreate'],
        onModuleDestroy: ['bar', 'onModuleDestroy'],
        onModuleStart: ['onModuleStart'],
        onModuleStop: ['onModuleStop'],
      }),
    );
  });
});
