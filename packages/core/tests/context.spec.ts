import {jest} from '@jest/globals';
import {EventEmitter} from 'events';
import {Component, ModuleClass, ModuleRoot, OnModuleCreate, OnModuleDestroy} from '../src/index.js';
import {inject} from '@sensejs/container';

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

    @ModuleClass()
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

    @ModuleClass({requires: [ModuleA]})
    class ModuleB {
      @OnModuleCreate()
      async onCreate(): Promise<void> {
        stubForCreateB();
      }

      @OnModuleDestroy()
      async onDestroy(): Promise<void> {}
    }

    @ModuleClass({requires: [ModuleA, ModuleB]})
    class ModuleC {}

    const app = new ModuleRoot(ModuleC);
    jest.spyOn(ModuleB.prototype, 'onDestroy').mockImplementation(() => mockedBLifecycleDestroyed);

    const startPromise = app.start();
    expect(stubForCreateB).not.toHaveBeenCalled();
    mockedModuleEvent.emit('create');
    await startPromise;
    expect(stubForCreateB).toHaveBeenCalled();

    const stopPromise = app.stop();
    expect(stubForDestroyA).not.toHaveBeenCalled();
    mockedModuleEvent.emit('destroy');
    await stopPromise;
    expect(stubForDestroyA).toHaveBeenCalled();
  });

  test('component', async () => {
    @Component()
    class FooComponent {}

    @ModuleClass({components: [FooComponent]})
    class FooModule {}

    const barComponentStub = jest.fn();

    @Component()
    class BarComponent {
      constructor(@inject(FooComponent) private fooComponent: FooComponent) {
        barComponentStub();
      }
    }

    @ModuleClass({requires: [FooModule], components: [BarComponent]})
    class BarModule {}

    const moduleRoot = new ModuleRoot(BarModule);
    await moduleRoot.start();
  });
});
