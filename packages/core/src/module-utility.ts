import {decorate, inject} from 'inversify';
import {ComponentFactory, ComponentScope, Constructor, ServiceIdentifier} from './interfaces';
import {Component} from './component';

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
    const decorator = inject(injectedSymbol) as ParameterDecorator;
    decorate(decorator, ConfigFactory, 0);
  }
  return ConfigFactory;
}
