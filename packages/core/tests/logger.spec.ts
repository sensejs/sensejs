import {inject} from 'inversify';
import {
  Component,
  ConsoleLoggerBuilder,
  createModule,
  InjectLogger,
  Logger,
  LOGGER_BUILDER_SYMBOL,
  LoggerModule,
  ModuleClass,
  ModuleRoot,
} from '../src';
import '@sensejs/testing-utility/lib/mock-console';

describe('InjectLogger', () => {
  test('Inject constructor param', () => {
    class X {
      constructor(@InjectLogger() param: Logger) {}
    }
  });

  test('Inject instance method param', () => {
    class X {
      foo(@InjectLogger() param: Logger) {}
    }
  });
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

    @ModuleClass({
      requires: [
        createModule({
          requires: [LoggerModule],
          constants: [{provide: LOGGER_BUILDER_SYMBOL, value: new MockLoggerBuilder()}],
        }),
      ],
      components: [FooComponent, BarComponent],
    })
    class MainModule {
      constructor(@inject(FooComponent) fooComponent: FooComponent, @inject(BarComponent) barComponent: BarComponent) {
      }
    }

    await new ModuleRoot(createModule({requires: [MainModule]})).start();
  });
});
