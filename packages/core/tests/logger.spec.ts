import {jest} from '@jest/globals';
import {
  Component,
  consoleLogger,
  createModule,
  Inject,
  InjectLogger,
  Logger,
  LOGGER_BUILDER_SYMBOL,
  LoggerBuilder,
  ModuleClass,
  ModuleRoot,
} from '../src/index.js';
import '@sensejs/testing-utility/lib/mock-console';

describe('InjectLogger', () => {
  test('Throw error when explicitly pass undefined', () => {
    expect(() => InjectLogger(undefined as any)).toThrow(TypeError);
  });

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
    class MockLoggerBuilder implements LoggerBuilder {
      build(): Logger {
        return consoleLogger;
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
        @Inject(FooComponent) private barComponent: FooComponent,
      ) {
        expect(spy).toHaveBeenCalledWith('CustomNamedLogger');
        expect(spy).toHaveBeenCalledWith(FooComponent.name);

        this.logger.info('bar');
      }
    }

    @ModuleClass({
      requires: [
        createModule({
          constants: [{provide: LOGGER_BUILDER_SYMBOL, value: new MockLoggerBuilder()}],
        }),
      ],
      components: [FooComponent, BarComponent],
    })
    class MainModule {
      constructor(@Inject(FooComponent) fooComponent: FooComponent, @Inject(BarComponent) barComponent: BarComponent) {}
    }

    await new ModuleRoot(createModule({requires: [MainModule]})).start();
  });
});
