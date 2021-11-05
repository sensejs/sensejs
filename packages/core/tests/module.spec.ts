import {jest} from '@jest/globals';
import {Container, InjectScope} from '@sensejs/container';
import {
  Component,
  ComponentFactory,
  ConstantProvider,
  DynamicModuleLoader,
  FactoryProvider,
  Inject,
  ModuleClass,
  ModuleInstance,
  ModuleOption,
  EntryModule,
  ModuleShutdownError,
  OnModuleCreate,
  OnModuleDestroy,
  OnModuleStart,
  OnModuleStop,
  ProcessManager,
  ServiceIdentifier,
} from '../src/index.js';

describe('Module resolve', () => {
  const id = Symbol();

  function createStubModule(option: ModuleOption, injectId: ServiceIdentifier = id) {
    @ModuleClass(option)
    class StubModule {
      constructor(@Inject(injectId) unnamed: unknown) {}

      @OnModuleCreate()
      onCreate(@Inject(injectId) unnamed: unknown) {}

      @OnModuleDestroy()
      onDestroy(@Inject(injectId) unnamed: unknown) {}
    }

    return StubModule;
  }

  test('Component resolve', async () => {
    @Component({id})
    class StubComponent {}

    abstract class GrantParent {
      bar() {
        return 'bar';
      }
    }

    abstract class Parent extends GrantParent {
      foo() {
        return 'foo';
      }
    }

    @Component({bindParentConstructor: true})
    class Child extends Parent {}

    @ModuleClass({
      components: [Child],
    })
    class MyModule {
      @OnModuleCreate()
      onCreate(
        @Inject(Parent) parent: Parent,
        @Inject(GrantParent) grantParent: GrantParent,
        @Inject(Child) child: Child,
      ) {
        expect(child).toStrictEqual(parent);
        expect(parent).toStrictEqual(grantParent);
        expect(child.foo()).toEqual('foo');
        expect(child.bar()).toEqual('bar');
      }
    }

    const instance = new EntryModule(
      createStubModule(
        {
          requires: [MyModule],
          components: [StubComponent],
        },
        StubComponent,
      ),
    );
    try {
      await instance.start();
    } catch (e) {
      console.error(e);
      throw e;
    }
    await instance.stop();
  });

  test('Factory resolve', async () => {
    @Component()
    class Factory extends ComponentFactory<void> {
      build() {}
    }

    const instance = new ModuleInstance(
      createStubModule({
        factories: [{provide: id, factory: Factory}],
      }),
      new Container(),
    );
    try {
      await instance.bootstrap();
      await instance.destroy();
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  test('Constants resolve', async () => {
    const instance = new ModuleInstance(
      createStubModule({
        constants: [{provide: id, value: Symbol()}],
      }),
      new Container(),
    );
    await instance.bootstrap();
    await instance.destroy();
  });

  test('dynamic resolve', async () => {
    @Component()
    class X {}

    const dynamicConstant: ConstantProvider<any> = {provide: 'constant', value: 'value'};
    @Component()
    class Factory extends ComponentFactory<void> {
      build() {
        return 'factory';
      }
    }
    const dynamicFactory: FactoryProvider<any> = {provide: 'factory', factory: Factory, scope: InjectScope.SINGLETON};

    const stub = jest.fn();

    @ModuleClass()
    class DynamicModule {
      @OnModuleCreate()
      onModuleCreate(@Inject(DynamicModuleLoader) loader: DynamicModuleLoader) {
        loader.addComponent(X);
        loader.addConstant(dynamicConstant);
        loader.addFactory(dynamicFactory);
        stub();
      }

      entryPoint(@Inject(X) x: X, @Inject('constant') constantValue: string, @Inject('factory') producedValue: string) {
        expect(x).toBeInstanceOf(X);
        expect(constantValue).toBe(dynamicConstant.value);
        expect(producedValue).toBe('factory');
      }
    }
    await EntryModule.run(DynamicModule, 'entryPoint');
    expect(stub).toHaveBeenCalled();
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

    await expect(() => EntryModule.run(A, 'main')).rejects.toBeInstanceOf(MyError);
  });

  test('run error', async () => {
    @ModuleClass()
    class A {
      main() {
        throw new MyError();
      }
    }

    await expect(() => EntryModule.run(A, 'main')).rejects.toBeInstanceOf(MyError);
  });

  test('start module', async () => {
    const onStart = jest.fn(),
      onStop = jest.fn(),
      main = jest.fn();

    @ModuleClass()
    class A {
      @OnModuleStart()
      onStart() {
        onStart();
      }

      @OnModuleStop()
      onStop() {
        expect(main).toHaveBeenCalled();
        onStop();
      }

      main(@Inject(ProcessManager) pm: ProcessManager) {
        expect(onStart).toHaveBeenCalled();
        setImmediate(() => {
          expect(onStop).not.toHaveBeenCalled();
          main();
          pm.shutdown();
        });
      }
    }
    await EntryModule.start(A, 'main');
    expect(onStop).toHaveBeenCalled();
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

    await expect(() => EntryModule.run(A, 'main')).rejects.toBeInstanceOf(ModuleShutdownError);
    await expect(() => EntryModule.run(A, 'main')).rejects.toMatchObject({
      error: expect.any(ShutdownError),
      nestedError: expect.any(MyError),
    });
  });

  test('lifecycle', async () => {
    const xOnCreateSpy = jest.fn(),
      xOnStart = jest.fn(),
      xOnStop = jest.fn(),
      xOnDestroySpy = jest.fn();
    const yOnCreateSpy = jest.fn(),
      yOnStart = jest.fn(),
      yOnStop = jest.fn(),
      yOnDestroySpy = jest.fn();
    const zOnCreateSpy = jest.fn(),
      zOnStart = jest.fn(),
      zOnStop = jest.fn(),
      zOnDestroySpy = jest.fn();

    @Component()
    class A {}

    const expectAllCreated = () => {
      expect(xOnCreateSpy).toHaveBeenCalled();
      expect(yOnCreateSpy).toHaveBeenCalled();
      expect(zOnCreateSpy).toHaveBeenCalled();
    };

    const expectAllNotDestroyed = () => {
      expect(xOnDestroySpy).not.toHaveBeenCalled();
      expect(yOnDestroySpy).not.toHaveBeenCalled();
      expect(zOnDestroySpy).not.toHaveBeenCalled();
    };

    @ModuleClass({
      components: [A],
    })
    class X {
      constructor(@Inject(A) unnamed: A) {}

      @OnModuleCreate()
      async onCreate(@Inject(A) unnamed: A) {
        await new Promise(setImmediate);
        expect(zOnCreateSpy).not.toHaveBeenCalled();
        xOnCreateSpy();
      }

      @OnModuleStart()
      async onStart() {
        expectAllCreated();
        await new Promise(setImmediate);
        xOnStart();
      }

      @OnModuleStop()
      async onStop() {
        xOnStop();
        await new Promise(setImmediate);
        expect(zOnStop).toHaveBeenCalled();
        expectAllNotDestroyed();
      }

      @OnModuleDestroy()
      async onDestroy(@Inject(A) unnamed: A) {
        expect(zOnDestroySpy).toHaveBeenCalled();
        xOnDestroySpy();
      }
    }

    @ModuleClass({
      requires: [X],
    })
    class Y {
      @OnModuleCreate()
      async onCreate(@Inject(A) unnamed: A) {
        await new Promise(setImmediate);
        expect(xOnCreateSpy).toHaveBeenCalled();
        expect(zOnCreateSpy).not.toHaveBeenCalled();
        yOnCreateSpy();
      }

      @OnModuleStart()
      async onStart() {
        await new Promise(setImmediate);
        yOnStart();
      }

      @OnModuleStop()
      async onStop() {
        yOnStop();
        await new Promise(setImmediate);
        expect(zOnStop).toHaveBeenCalled();
        expectAllNotDestroyed();
      }

      @OnModuleDestroy()
      async onDestroy(@Inject(A) unnamed: A) {
        yOnDestroySpy();
        await new Promise(setImmediate);
        expect(xOnDestroySpy).not.toHaveBeenCalled();
        expect(zOnDestroySpy).toHaveBeenCalled();
      }
    }

    @ModuleClass({
      requires: [X, Y],
    })
    class Z {
      constructor(@Inject(A) unnamed: A) {}

      @OnModuleCreate()
      async onCreate(@Inject(A) unnamed: A) {
        expect(xOnCreateSpy).toHaveBeenCalled();
        expect(yOnCreateSpy).toHaveBeenCalled();
        zOnCreateSpy();
      }

      @OnModuleStart()
      async onStart() {
        expect(xOnStart).toHaveBeenCalled();
        expect(yOnStart).toHaveBeenCalled();
        zOnStart();
      }

      @OnModuleStop()
      async onStop() {
        zOnStop();
        expect(xOnStop).not.toHaveBeenCalled();
        expect(yOnStop).not.toHaveBeenCalled();
        expectAllNotDestroyed();
      }

      @OnModuleDestroy()
      async onDestroy(@Inject(A) unnamed: A) {
        expect(xOnDestroySpy).not.toHaveBeenCalled();
        expect(yOnDestroySpy).not.toHaveBeenCalled();
        zOnDestroySpy();
      }
    }

    const moduleRoot = new EntryModule(Z);

    await moduleRoot.start();
    expect(zOnCreateSpy).toHaveBeenCalled();
    expect(xOnStart).toHaveBeenCalled();
    expect(yOnStart).toHaveBeenCalled();
    expect(zOnStart).toHaveBeenCalled();
    await moduleRoot.shutdown();
    expect(xOnStop).toHaveBeenCalled();
    expect(yOnStop).toHaveBeenCalled();
    expect(zOnStop).toHaveBeenCalled();
    expect(xOnDestroySpy).toHaveBeenCalled();
  });
});
