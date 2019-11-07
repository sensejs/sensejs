import 'reflect-metadata';
import {Logger, LoggerFactory} from '@sensejs/logger';
import {
  ApplicationFactory,
  Component,
  InjectLogger,
  LoggerBuilder,
  LoggerFactorySymbol,
  LoggerModule,
  Module,
} from '../src';
import {inject} from 'inversify';

describe('LoggerModule', () => {
  test('Logger', async () => {
    class MockLoggerFactory extends LoggerFactory {
      constructor() {
        super('', []);
      }
    }

    @Component()
    class FooComponent {
      constructor(@InjectLogger private logger: Logger) {
        this.logger.info('foo');
      }
    }

    @Component()
    class BarComponent {
      constructor(@InjectLogger private logger: Logger, @inject(FooComponent) private barComponent: FooComponent) {
        this.logger.info('bar');
      }
    }

    class MainModule extends Module({
      requires: [LoggerModule],
      components: [FooComponent, BarComponent],
      constants: [{provide: LoggerFactorySymbol, value: new MockLoggerFactory()}],
    }) {
      constructor(@inject(FooComponent) fooComponent: FooComponent, @inject(BarComponent) barComponent: BarComponent) {
        super();
      }
    }

    await new ApplicationFactory(Module({requires: [MainModule]})).start();
  });
});
