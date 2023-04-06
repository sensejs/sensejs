import {jest} from '@jest/globals';
import {Container, DuplicatedBindingError, Injectable, InjectScope} from '@sensejs/container';
import {
  Component,
  ComponentFactory,
  ConstantProvider,
  DynamicModuleLoader,
  FactoryProvider,
  Inject,
  Module,
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
    @Module(option)
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

    @Injectable()
    abstract class GrantParent {
      bar() {
        return 'bar';
      }
    }

    @Injectable()
    abstract class Parent extends GrantParent {
      foo() {
        return 'foo';
      }
    }

    @Component()
    class Child extends Parent {}

    @Module({
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

    const dynamicConstant: ConstantProvider = {provide: 'constant', value: 'value'};
    @Component()
    class Factory extends ComponentFactory<void> {
      build() {
        return 'factory';
      }
    }
    const dynamicFactory: FactoryProvider = {provide: 'factory', factory: Factory, scope: InjectScope.SINGLETON};

    const stub = jest.fn();

    @Module()
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

  test('entry has duplicate binding', async () => {
    const aOnDestroy = jest.fn();

    @Component()
    class MyComponent {}
    @Module({
      components: [MyComponent],
    })
    class MyModuleA {
      @OnModuleDestroy()
      onDestroy() {
        aOnDestroy();
      }
    }

    const onDestroy = jest.fn();

    @Module({
      requires: [MyModuleA],
    })
    class BadApp {
      @OnModuleCreate()
      onModuleCreate(@Inject(DynamicModuleLoader) loader: DynamicModuleLoader) {
        loader.addComponent(MyComponent);
      }
      main() {}

      @OnModuleDestroy()
      onModuleDestroy() {
        onDestroy();
      }
    }

    await expect(EntryModule.start(BadApp)).rejects.toBeInstanceOf(DuplicatedBindingError);
    expect(aOnDestroy).toHaveBeenCalled();
    expect(onDestroy).not.toHaveBeenCalled();
  });

  test('shutdown during on create', async () => {
    @Module()
    class MyModuleB {
      main() {}

      @OnModuleCreate()
      onModuleDestroy(@Inject(ProcessManager) manager: ProcessManager) {
        return new Promise((resolve) => {
          manager.shutdown();
          setImmediate(resolve);
        });
      }
    }
    await EntryModule.run(MyModuleB, 'main');
  });

  test('duplicate binding', async () => {
    @Component()
    class MyComponent {}
    @Module({
      components: [MyComponent],
    })
    class MyModuleA {}
    const entrySpy = jest.fn();
    const onDestroySpy = jest.fn();

    @Module({
      components: [MyComponent],
      requires: [MyModuleA],
    })
    class MyModuleB {
      main() {}

      @OnModuleDestroy()
      onModuleDestroy() {
        onDestroySpy();
      }
    }
    await expect(() => EntryModule.start(MyModuleB)).rejects.toBeInstanceOf(DuplicatedBindingError);
    expect(entrySpy).not.toHaveBeenCalled();
    expect(onDestroySpy).not.toHaveBeenCalled();
  });

  test('duplicate dynamic binding', async () => {
    const entrySpy = jest.fn();
    const onDestroySpy = jest.fn();
    @Component()
    class MyComponent {}
    @Module({
      components: [MyComponent],
    })
    class MyModule {
      @OnModuleCreate()
      onModuleCreate(@Inject(DynamicModuleLoader) loader: DynamicModuleLoader) {
        loader.addComponent(MyComponent);
      }

      main() {
        entrySpy();
      }
      @OnModuleDestroy()
      onModuleDestroy() {
        onDestroySpy();
      }
    }

    await expect(() => EntryModule.start(MyModule)).rejects.toBeInstanceOf(DuplicatedBindingError);
    expect(entrySpy).not.toHaveBeenCalled();
    expect(onDestroySpy).not.toHaveBeenCalled();
  });

  test('startup error', async () => {
    @Module()
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
    @Module()
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

    @Module()
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

    @Module()
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

    @Module({
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

    @Module({
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

    @Module({
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
