import 'reflect-metadata';
import {Module, ModuleLifecycle, setModuleMetadata} from '../src/module';
import {Logger, LoggerModule, TraceId} from '../src/logger-module';
import {Component} from '../src/component';
import {inject, Container} from 'inversify';
import {ApplicationFactory} from '../src/application-factory';
import {Constructor, Abstract} from '../src/interfaces';


describe('LoggerModule', () => {

    test('Logger', async () => {

        @Component()
        class FooComponent {
            constructor(@inject(Logger) private logger: Logger) {
                this.logger.info('foo');
            }
        }

        @Component()
        class BarComponent {
            constructor(@inject(Logger) private logger: Logger,
                        @inject(FooComponent) private barComponent: FooComponent) {
                this.logger.info('bar');
            }
        }

        // const FooModule = Module({requires: [LoggerModule], components: [FooComponent, BarComponent]})
        class FooModule extends Module({requires: [LoggerModule], components: [FooComponent, BarComponent]}) {
        }

        class MainModule extends Module({requires: [FooModule]}) {
            constructor(@inject(FooComponent) fooComponent: FooComponent,
                        @inject(BarComponent) barComponent: BarComponent) {
                super();
            }
        }

        await new ApplicationFactory(Module({requires:[FooModule]})).start();

    });
});
