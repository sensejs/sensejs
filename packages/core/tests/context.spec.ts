import {EventEmitter} from 'events';
import {Component, ModuleClass, ModuleRoot, OnModuleCreate} from '../src';
import {inject} from 'inversify';

describe('ModuleRoot', () => {
  test('lifecycle', async () => {
    const mockedModuleEvent = new EventEmitter();
    const mockedALifecycleCreated = new Promise<void>((done) => {
      mockedModuleEvent.once('create', done);
    });

    const mockedBLifecycleDestroyed = new Promise<void>((done) => {
      mockedModuleEvent.once('destroy', done);
    });

    @ModuleClass()
    class ModuleA {
      @OnModuleCreate()
      async onCreate(): Promise<void> {
        await mockedALifecycleCreated;
      }

      @OnModuleCreate()
      async onDestroy(): Promise<void> {
      }
    }

    @ModuleClass({requires: [ModuleA]})
    class ModuleB {
      @OnModuleCreate()
      async onCreate(): Promise<void> {
      }

      @OnModuleCreate()
      async onDestroy(): Promise<void> {
      }

    }

    @ModuleClass({requires: [ModuleA, ModuleB]})
    class ModuleC {

    }

    const app = new ModuleRoot(ModuleC);
    const spyOnCreateForB = jest.spyOn(ModuleB.prototype, 'onCreate');
    const spyOnDestroyForA = jest.spyOn(ModuleA.prototype, 'onDestroy');
    jest.spyOn(ModuleB.prototype, 'onDestroy').mockImplementation(() => mockedBLifecycleDestroyed);
    const startPromise = app.start();
    expect(spyOnCreateForB).not.toHaveBeenCalled();
    mockedModuleEvent.emit('create');
    await startPromise;
    expect(spyOnCreateForB).toHaveBeenCalled();
    const stopPromise = app.stop();
    expect(spyOnDestroyForA).not.toHaveBeenCalled();
    mockedModuleEvent.emit('destroy');
    await stopPromise;
    expect(spyOnDestroyForA).toHaveBeenCalled();
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
