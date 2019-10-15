import 'reflect-metadata';
import {Module} from '../src/module';
import {Logger, LoggerModule} from '../src/logger-module';
import {Component} from '../src/component';
import {inject} from 'inversify';
import {ApplicationFactory} from '../src/application-factory';


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

        class FooModule extends Module({requires: [LoggerModule], components: [FooComponent, BarComponent]}) {
        }

        class MainModule extends Module({requires: [FooModule]}) {
            constructor(@inject(FooComponent) fooComponent: FooComponent,
                        @inject(BarComponent) barComponent: BarComponent) {
                super();
            }
        }

        await new ApplicationFactory(Module({requires: [FooModule]})).start();

    });
});
