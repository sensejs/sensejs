import {ComponentFactory, Constructor, FactoryProvider, ServiceIdentifier} from './interfaces';
import {Component} from './component';
import {Inject} from './decorators';
import {InjectScope} from '@sensejs/container';

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
  @Component({scope: InjectScope.SINGLETON})
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
        this.connection = undefined;
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
    scope: InjectScope.SINGLETON,
  };
}

export function createConfigHelperFactory<Result, Fallback = Partial<Result>, Injected = Partial<Result>>(
  fallback: Fallback | undefined,
  injectedSymbol: ServiceIdentifier | undefined,
  configMerger: (fallback?: Fallback, injected?: Injected) => Result,
): Constructor<ComponentFactory<Result>> {
  @Component({scope: InjectScope.SINGLETON})
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
    Inject(injectedSymbol)(ConfigFactory, undefined, 0);
  }
  return ConfigFactory;
}

export function provideOptionInjector<Result, Fallback = Partial<Result>, Injected = Partial<Result>>(
  fallback: Fallback | undefined,
  injectOptionFrom: ServiceIdentifier | undefined,
  configMerger: (fallback?: Fallback, injected?: Injected) => Result,
  exportSymbol: symbol = Symbol(),
): FactoryProvider<Result> {
  return {
    provide: exportSymbol,
    factory: createConfigHelperFactory(fallback, injectOptionFrom, configMerger),
    scope: InjectScope.SINGLETON,
  };
}
