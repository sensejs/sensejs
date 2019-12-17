import {ComponentFactory, ComponentScope, Constructor, ServiceIdentifier, FactoryProvider} from './interfaces';
import {Component} from './component';
import {Inject} from './param-binding';

export interface ConnectionFactoryProvider<T, Option> extends FactoryProvider<T> {
  factory: Constructor<AbstractConnectionFactory<T, Option>>;
}

export abstract class AbstractConnectionFactory<T, Option> extends ComponentFactory<T> {
  abstract connect(option: Option): Promise<T>;

  abstract disconnect(): Promise<void>;
}

export function createConnectionFactory<T, Option>(
  init: (option: Option) => Promise<T>,
  destroy: (conn: T) => Promise<void>,
): Constructor<AbstractConnectionFactory<T, Option>> {
  @Component({scope: ComponentScope.SINGLETON})
  class ConnectionFactory extends AbstractConnectionFactory<T, Option> {
    private connection?: T;

    constructor() {
      super();
    }

    build(): T {
      if (this.connection) {
        return this.connection;
      }
      throw new Error('Requested connection not created yet');
    }

    async connect(option: Option): Promise<T> {
      this.connection = await init(option);
      return this.connection;
    }

    async disconnect() {
      if (this.connection) {
        const connection = this.connection;
        delete this.connection;
        await destroy(connection);
      }
    }
  }

  return ConnectionFactory;
}

export function provideConnectionFactory<T, Option>(
  init: (option: Option) => Promise<T>,
  destroy: (conn: T) => Promise<void>,
  exportSymbol: ServiceIdentifier<T> = Symbol(),
): ConnectionFactoryProvider<T, Option> {
  return {
    provide: exportSymbol,
    factory: createConnectionFactory<T, Option>(init, destroy),
    scope: ComponentScope.SINGLETON,
  };
}

export function createConfigHelperFactory<Result, Fallback = Partial<Result>, Injected = Partial<Result>>(
  fallback: Fallback | undefined,
  injectedSymbol: ServiceIdentifier<unknown> | undefined,
  configMerger: (fallback?: Fallback, injected?: Injected) => Result,
): Constructor<ComponentFactory<Result>> {
  @Component({scope: ComponentScope.SINGLETON})
  class ConfigFactory extends ComponentFactory<Result> {
    private readonly injectedConfig?: Injected;

    constructor(...args: any[]) {
      super();
      this.injectedConfig = args[0];
    }

    build(): Result {
      return configMerger(fallback, this.injectedConfig);
    }
  }

  if (injectedSymbol) {
    const decorator = Inject(injectedSymbol);
    Inject(injectedSymbol)(ConfigFactory, undefined, 0);
  }
  return ConfigFactory;
}

export function provideOptionInjector<Result, Fallback = Partial<Result>, Injected = Partial<Result>>(
  fallback: Fallback | undefined,
  injectOptionFrom: ServiceIdentifier<unknown> | undefined,
  configMerger: (fallback?: Fallback, injected?: Injected) => Result,
  exportSymbol: symbol = Symbol(),
): FactoryProvider<Result> {
  return {
    provide: exportSymbol,
    factory: createConfigHelperFactory(fallback, injectOptionFrom, configMerger),
    scope: ComponentScope.SINGLETON,
  };
}
