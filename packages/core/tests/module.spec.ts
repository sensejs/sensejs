import {Container} from 'inversify';
import {
  Component,
  ComponentFactory,
  createModule,
  getModuleMetadata,
  Inject,
  ModuleClass,
  ModuleOption,
  ModuleRoot,
  ModuleShutdownError,
  Named,
  OnModuleCreate,
  OnModuleDestroy,
  Tagged,
} from '../src';
import {ModuleInstance} from '../src/module-instance';

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
      }),
    );
  });
});

describe('ModuleInstance', () => {
  const container = new Container();
  const injectToken = Symbol();
  container.bind(injectToken).toConstantValue(Symbol());
  test('Run Module lifecycle', async () => {
    // For unknown reason jest.spy does not work here. Use stub pattern instead
    const onCreateStub = jest.fn(),
      onDestroyStub = jest.fn();

    @ModuleClass()
    class TestModule {
      @OnModuleCreate()
      onModuleCreate(@Inject(injectToken) param: any) {
        onCreateStub();
      }

      @OnModuleDestroy()
      async onModuleDestroy() {
        onDestroyStub();
      }
    }

    const moduleInstance = new ModuleInstance(TestModule, container);
    await moduleInstance.onSetup();
    expect(onCreateStub).toHaveBeenCalled();
    await moduleInstance.onDestroy();
    expect(onDestroyStub).toHaveBeenCalled();
  });

  test('Call inherited module lifecycle', async () => {
    // For unknown reason jest.spy does not work here. Use stub pattern instead
    const onCreateStub = jest.fn(),
      onDestroyStub = jest.fn();

    @ModuleClass()
    class Parent {
      @OnModuleCreate()
      onModuleCreate(@Inject(injectToken) param: any) {
        onCreateStub();
      }

      @OnModuleDestroy()
      async onModuleDestroy() {}
    }

    @ModuleClass()
    class Child extends Parent {
      @OnModuleDestroy()
      async onChildModuleDestroy() {
        onDestroyStub();
      }
    }

    const moduleInstance = new ModuleInstance(Child, container);
    await moduleInstance.onSetup();
    expect(onCreateStub).toHaveBeenCalled();
    await moduleInstance.onDestroy();
    expect(onDestroyStub).toHaveBeenCalled();
  });
});

describe('Module resolve', () => {
  const name = 'name' + Math.random();
  const key = Symbol();
  const value = Symbol();
  const id = Symbol();

  const unnamedId = Symbol();
  const namedId = Symbol();
  const taggedId = Symbol();

  function createStubModule(option: ModuleOption) {
    @ModuleClass(option)
    class StubModule {
      constructor(
        @Inject(unnamedId) unnamed: unknown,
        @Inject(namedId) @Named(name) named: unknown,
        @Inject(taggedId) @Tagged(key, value) tagged: unknown,
      ) {}

      @OnModuleCreate()
      onCreate(
        @Inject(unnamedId) unnamed: unknown,
        @Inject(namedId) @Named(name) named: unknown,
        @Inject(taggedId) @Tagged(key, value) tagged: unknown,
      ) {}

      @OnModuleDestroy()
      onDestroy(
        @Inject(unnamedId) unnamed: unknown,
        @Inject(namedId) @Named(name) named: unknown,
        @Inject(taggedId) @Tagged(key, value) tagged: unknown,
      ) {}
    }

    return StubModule;
  }

  test('Component resolve', async () => {
    @Component({id: unnamedId})
    class UnnamedComponent {}

    @Component({id: namedId, name})
    class NamedComponent {}

    @Component({id: taggedId, tags: [{key, value}]})
    class TaggedComponent {}

    const instance = new ModuleInstance(
      createStubModule({
        components: [UnnamedComponent, NamedComponent, TaggedComponent],
      }),
      new Container(),
    );
    await instance.onSetup();
    await instance.onDestroy();
  });

  test('Factory resolve', async () => {
    @Component()
    class UnnamedComponent extends ComponentFactory<void> {
      build() {}
    }

    @Component()
    class NamedComponent extends ComponentFactory<void> {
      build() {}
    }

    @Component()
    class TaggedComponent extends ComponentFactory<void> {
      build() {}
    }

    const instance = new ModuleInstance(
      createStubModule({
        factories: [
          {provide: unnamedId, factory: UnnamedComponent},
          {provide: namedId, factory: NamedComponent},
          {provide: taggedId, factory: TaggedComponent},
        ],
      }),
      new Container(),
    );
    await instance.onSetup();
    await instance.onDestroy();
  });

  test('Constants resolve', async () => {
    const instance = new ModuleInstance(
      createStubModule({
        constants: [
          {provide: unnamedId, value: Symbol()},
          {provide: namedId, value: Symbol()},
          {provide: taggedId, value: Symbol()},
        ],
      }),
      new Container(),
    );
    await instance.onSetup();
    await instance.onDestroy();
  });
});

describe('Module Root', () => {
  class MyError extends Error {}

  test('startup error', async () => {
    @ModuleClass()
    class A {
      @OnModuleCreate()
      onModuleCreate() {
        throw new MyError();
      }

      main() {}
    }

    await expect(() => ModuleRoot.run(A, 'main')).rejects.toBeInstanceOf(MyError);
  });

  test('run error', async () => {
    @ModuleClass()
    class A {
      main() {
        throw new MyError();
      }
    }

    await expect(() => ModuleRoot.run(A, 'main')).rejects.toBeInstanceOf(MyError);
  });

  test('shutdown error', async () => {
    class ShutdownError extends Error {}

    @ModuleClass()
    class A {
      main() {
        throw new MyError();
      }

      @OnModuleDestroy()
      onModuleCreate() {
        throw new ShutdownError();
      }
    }

    await expect(() => ModuleRoot.run(A, 'main')).rejects.toBeInstanceOf(ModuleShutdownError);
    await expect(() => ModuleRoot.run(A, 'main')).rejects.toMatchObject({
      error: expect.any(ShutdownError),
      nestedError: expect.any(MyError),
    });
  });

  test('lifecycle', async () => {
    const xOnCreateSpy = jest.fn(),
      xOnDestroySpy = jest.fn();
    const yOnCreateSpy = jest.fn(),
      yOnDestroySpy = jest.fn();
    const zOnCreateSpy = jest.fn(),
      zOnDestroySpy = jest.fn();

    @Component()
    class A {}

    @ModuleClass({
      components: [A],
    })
    class X {
      constructor(@Inject(A) unnamed: A) {}

      @OnModuleCreate()
      onCreate(@Inject(A) unnamed: A) {
        expect(zOnCreateSpy).not.toHaveBeenCalled();
        xOnCreateSpy();
      }

      @OnModuleDestroy()
      onDestroy(@Inject(A) unnamed: A) {
        expect(zOnDestroySpy).toHaveBeenCalled();
        xOnDestroySpy();
      }
    }

    @ModuleClass({
      requires: [X],
    })
    class Y {
      @OnModuleCreate()
      onCreate(@Inject(A) unnamed: A) {
        expect(xOnCreateSpy).toHaveBeenCalled();
        expect(zOnCreateSpy).not.toHaveBeenCalled();
        yOnCreateSpy();
      }

      @OnModuleDestroy()
      onDestroy(@Inject(A) unnamed: A) {
        expect(xOnDestroySpy).not.toHaveBeenCalled();
        expect(zOnDestroySpy).toHaveBeenCalled();
        yOnDestroySpy();
      }
    }

    @ModuleClass({
      requires: [X, Y],
    })
    class Z {
      constructor(@Inject(A) unnamed: A) {}

      @OnModuleCreate()
      onCreate(@Inject(A) unnamed: A) {
        expect(xOnCreateSpy).toHaveBeenCalled();
        expect(yOnCreateSpy).toHaveBeenCalled();
        zOnCreateSpy();
      }

      @OnModuleDestroy()
      onDestroy(@Inject(A) unnamed: A) {
        expect(xOnDestroySpy).not.toHaveBeenCalled();
        expect(yOnDestroySpy).not.toHaveBeenCalled();
        zOnDestroySpy();
      }
    }

    const moduleRoot = new ModuleRoot(Z);

    await moduleRoot.start();
    expect(zOnCreateSpy).toHaveBeenCalled();
    await moduleRoot.stop();
    expect(xOnDestroySpy).toHaveBeenCalled();
  });
});
