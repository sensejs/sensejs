import {inject} from 'inversify';
import {
  Component,
  ConsoleLoggerBuilder,
  InjectLogger,
  Logger,
  LOGGER_BUILDER_SYMBOL,
  LoggerModule,
  Module,
  ModuleRoot,
} from '../src';

jest.spyOn(global.console, 'error').mockImplementation(jest.fn());
jest.spyOn(global.console, 'warn').mockImplementation(jest.fn());
jest.spyOn(global.console, 'info').mockImplementation(jest.fn());
jest.spyOn(global.console, 'log').mockImplementation(jest.fn());
jest.spyOn(global.console, 'debug').mockImplementation(jest.fn());
jest.spyOn(global.console, 'trace').mockImplementation(jest.fn());

test('ConsoleLogger', () => {
  const logger = new ConsoleLoggerBuilder().build();
  logger.fatal('fatal');
  logger.error('error');
  logger.warn('warn');
  logger.info('info');
  logger.log('log');
  logger.debug('debug');
  logger.trace('debug');
});
describe('Logger', () => {
  test('Logger', async () => {
    class MockLoggerBuilder extends ConsoleLoggerBuilder {
      build(): Logger {
        return super.build();
      }
    }

    const spy = jest.spyOn(MockLoggerBuilder.prototype, 'build');

    @Component()
    class FooComponent {
      constructor(@InjectLogger(FooComponent) private logger: Logger) {
        this.logger.info('foo');
        this.logger.info('foo');
        this.logger.info('foo');
        this.logger.info('foo');
        this.logger.info('foo');
        expect(spy).toHaveBeenCalledWith(FooComponent.name);
      }
    }

    @Component()
    class BarComponent {
      constructor(
        @InjectLogger('CustomNamedLogger') private logger: Logger,
        @InjectLogger() private unnamedLogger: Logger,
        @inject(FooComponent) private barComponent: FooComponent,
      ) {
        expect(spy).toHaveBeenCalledWith('CustomNamedLogger');
        expect(spy).toHaveBeenCalledWith(FooComponent.name);

        this.logger.info('bar');
      }
    }

    class MainModule extends Module({
      requires: [
        Module({
          requires: [LoggerModule],
          constants: [{provide: LOGGER_BUILDER_SYMBOL, value: new MockLoggerBuilder()}],
        }),
      ],
      components: [FooComponent, BarComponent],
    }) {
      constructor(@inject(FooComponent) fooComponent: FooComponent, @inject(BarComponent) barComponent: BarComponent) {
        super();
      }
    }

    await new ModuleRoot(Module({requires: [MainModule]})).start();
  });
});
