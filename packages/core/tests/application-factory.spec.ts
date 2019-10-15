import 'reflect-metadata';
import {ApplicationFactory} from '../src/application-factory';
import {Module, ModuleLifecycle, setModuleMetadata} from '../src/module';
import {Constructor, ServiceIdentifier} from '../src/interfaces';
import {EventEmitter} from 'events';
import {Component} from '../src/component';
import {inject} from 'inversify';


describe('ApplicationFactory', () => {
    test('lifecycle', async () => {

        let mockedModuleEvent = new EventEmitter();
        let mockedALifecycleCreated = new Promise<void>((done) => {
            mockedModuleEvent.once('create', done);
        });

        let mockedBLifecycleDestroyed = new Promise<void>((done) => {
            mockedModuleEvent.once('destroy', done);
        });

        class ModuleALifecycle extends ModuleLifecycle {

            async onCreate(componentList: ServiceIdentifier<unknown>[]): Promise<void> {
                await mockedALifecycleCreated;
            }

            async onDestroy(): Promise<any> {
            }
        }

        function ModuleDecoratorA() {
            return class ModuleA extends Module() {

            };
            // return function <T>(target: Constructor<T>) {
            //     setModuleMetadata(target, {
            //         requires: [],
            //         components: [],
            //         moduleLifecycleFactory: container => {
            //             return new ModuleALifecycle(container);
            //         }
            //     });
            // };
        }


        const ModuleA = ModuleDecoratorA();

        const ModuleB = Module({requires: [ModuleA]})

        const app = new ApplicationFactory(ModuleB);
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
        class FooComponent {
        }

        const FooModule = Module({components: [FooComponent]});
        // class FooModule {
        //
        // }


        const barComponentStub = jest.fn();

        @Component()
        class BarComponent {
            constructor(@inject(FooComponent) private fooComponent: FooComponent) {

                barComponentStub();

            }

        }

        class BarModule extends Module({requires: [FooModule], components: [BarComponent]}) {};
        // class BarModule {
        //     constructor(@inject(BarComponent) barComponent: BarComponent) {
        //     }
        // }

        const app = new ApplicationFactory(BarModule);
        await app.start();


    });
});
