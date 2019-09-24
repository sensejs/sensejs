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

        @Module({requires: [LoggerModule], components: [FooComponent, BarComponent]})
        class FooModule {
            constructor(
                @inject(FooComponent) fooComponent,
                @inject(BarComponent) barComponent
            ) {

            }

        }

        await new ApplicationFactory(FooModule).start();

    });
});
