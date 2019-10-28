import 'reflect-metadata';
import {Logger} from '@sensejs/logger';
import {ApplicationFactory, Component, InjectLogger, LoggerModule, Module} from '../src';
import {inject} from 'inversify';


describe('LoggerModule', () => {

    test('Logger', async () => {

        @Component()
        class FooComponent {
            constructor(@InjectLogger private logger: Logger) {
                this.logger.info('foo');
            }
        }

        @Component()
        class BarComponent {
            constructor(@InjectLogger private logger: Logger,
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

        await new ApplicationFactory(Module({requires: [MainModule]})).start();

    });
});
