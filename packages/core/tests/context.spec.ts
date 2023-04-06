import {jest} from '@jest/globals';
import {EventEmitter} from 'events';
import {Component, Module, EntryModule, OnModuleCreate, OnModuleDestroy} from '../src/index.js';
import {Inject} from '@sensejs/container';

describe('ModuleRoot', () => {
  test('lifecycle', async () => {
    const mockedModuleEvent = new EventEmitter();
    const mockedALifecycleCreated = new Promise<void>((done) => {
      mockedModuleEvent.once('create', done);
    });

    const mockedBLifecycleDestroyed = new Promise<void>((done) => {
      mockedModuleEvent.once('destroy', done);
    });
    const stubForCreateB = jest.fn();
    const stubForDestroyA = jest.fn();

    @Module()
    class ModuleA {
      @OnModuleCreate()
      async onCreate(): Promise<void> {
        await mockedALifecycleCreated;
      }

      @OnModuleDestroy()
      async onDestroy(): Promise<void> {
        stubForDestroyA();
      }
    }

    @Module({requires: [ModuleA]})
    class ModuleB {
      @OnModuleCreate()
      async onCreate(): Promise<void> {
        stubForCreateB();
      }

      @OnModuleDestroy()
      async onDestroy(): Promise<void> {}
    }

    @Module({requires: [ModuleA, ModuleB]})
    class ModuleC {}

    const app = new EntryModule(ModuleC);
    jest.spyOn(ModuleB.prototype, 'onDestroy').mockImplementation(() => mockedBLifecycleDestroyed);

    const startPromise = app.start();
    expect(stubForCreateB).not.toHaveBeenCalled();
    mockedModuleEvent.emit('create');
    await startPromise;
    expect(stubForCreateB).toHaveBeenCalled();

    const stopPromise = app.shutdown();
    expect(stubForDestroyA).not.toHaveBeenCalled();
    mockedModuleEvent.emit('destroy');
    await stopPromise;
    expect(stubForDestroyA).toHaveBeenCalled();
  });

  test('component', async () => {
    @Component()
    class FooComponent {}

    @Module({components: [FooComponent]})
    class FooModule {}

    const barComponentStub = jest.fn();

    @Component()
    class BarComponent {
      constructor(@Inject(FooComponent) private fooComponent: FooComponent) {
        barComponentStub();
      }
    }

    @Module({requires: [FooModule], components: [BarComponent]})
    class BarModule {}

    const moduleRoot = new EntryModule(BarModule);
    await moduleRoot.start();
  });
});
