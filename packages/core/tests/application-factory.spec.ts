import 'reflect-metadata';
import {EventEmitter} from 'events';
import {ApplicationFactory, Component, Module} from '../src';
import {inject} from 'inversify';

describe('ApplicationFactory', () => {
  test('lifecycle', async () => {
    const mockedModuleEvent = new EventEmitter();
    const mockedALifecycleCreated = new Promise<void>((done) => {
      mockedModuleEvent.once('create', done);
    });

    const mockedBLifecycleDestroyed = new Promise<void>((done) => {
      mockedModuleEvent.once('destroy', done);
    });

    class ModuleA extends Module() {
      async onCreate(): Promise<void> {
        await mockedALifecycleCreated;
      }
    }

    const ModuleB = Module({requires: [ModuleA]});

    const ModuleC = Module({requires: [ModuleA, ModuleB]});

    const app = new ApplicationFactory(ModuleC);
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

    const FooModule = Module({components: [FooComponent]});

    const barComponentStub = jest.fn();

    @Component()
    class BarComponent {
      constructor(@inject(FooComponent) private fooComponent: FooComponent) {
        barComponentStub();
      }
    }

    class BarModule extends Module({requires: [FooModule], components: [BarComponent]}) {}

    const app = new ApplicationFactory(BarModule);
    await app.start();
  });
});
