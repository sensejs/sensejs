/* tslint:disable no-console */
import {Module} from './module';
import {ComponentFactory, ComponentFactoryContext, ComponentScope} from './interfaces';
import {inject, optional, targetName} from 'inversify';
import {Component} from './component';

const LOGGER_SYMBOL = Symbol('LOGGER_SYMBOL');
export const LOGGER_BUILDER_SYMBOL = Symbol('LOGGER_BUILDER_SYMBOL');

export function InjectLogger(name?: string | Function) {
  const labelName = typeof name === 'function' ? name.name : typeof name === 'string' ? name : '';
  return (target: object, property: string, index: number) => {
    inject(LOGGER_SYMBOL)(target, property, index);
    targetName(labelName)(target, property, index);
  };
}

export interface Logger {
  /**
   * Log message with severity of trace
   * @param content messages
   */
  trace(...content: [unknown, ...unknown[]]): void;

  /**
   * Log message with severity of debug
   * @param content messages
   */
  debug(...content: [unknown, ...unknown[]]): void;

  /**
   * alias of info
   * @param content messages
   */
  log(...content: [unknown, ...unknown[]]): void;

  /**
   * Log message with severity of info
   * @param content messages
   */
  info(...content: [unknown, ...unknown[]]): void;

  /**
   * Log message with severity of warning
   * @param content messages
   */
  warn(...content: [unknown, ...unknown[]]): void;

  /**
   * Log message with severity of error
   * @param content messages
   */
  error(...content: [unknown, ...unknown[]]): void;

  /**
   * Log message with severity of error
   * @param content messages
   */
  fatal(...content: [unknown, ...unknown[]]): void;
}

class ConsoleLogger implements Logger {
  debug(...content: [unknown, ...unknown[]]): void {
    console.debug(...content);
  }

  error(...content: [unknown, ...unknown[]]): void {
    console.error(...content);
  }

  fatal(...content: [unknown, ...unknown[]]): void {
    console.error(...content);
  }

  info(...content: [unknown, ...unknown[]]): void {
    console.info(...content);
  }

  log(...content: [unknown, ...unknown[]]): void {
    console.log(...content);
  }

  trace(...content: [unknown, ...unknown[]]): void {
    console.trace(...content);
  }

  warn(...content: [unknown, ...unknown[]]): void {
    console.warn(...content);
  }
}

export interface LoggerBuilder {
  build(loggerLabel: string): Logger;
}

export const consoleLogger = new ConsoleLogger();

@Component()
export class ConsoleLoggerBuilder implements LoggerBuilder {
  build(): Logger {
    return consoleLogger;
  }
}

export class LoggerFactory extends ComponentFactory<Logger> {
  constructor(
    @inject(LOGGER_BUILDER_SYMBOL)
    @optional()
    private loggerBuilder: LoggerBuilder = new ConsoleLoggerBuilder(),
  ) {
    super();
  }

  build(context: ComponentFactoryContext): Logger {
    const parentRequest = context.currentRequest.parentRequest;
    let moduleName = context.currentRequest.target.name.value();

    const parent = parentRequest ? parentRequest.serviceIdentifier : null;
    if (!moduleName) {
      moduleName =
        parent === null
          ? ''
          : typeof parent === 'symbol'
            ? parent.toString()
            : typeof parent === 'string'
              ? parent
              : typeof parent === 'function'
                ? parent.name
                : '';
    }

    return this.loggerBuilder.build(moduleName);
  }
}

export const LoggerModule = Module({
  factories: [
    {
      provide: LOGGER_SYMBOL,
      factory: LoggerFactory,
      scope: ComponentScope.TRANSIENT,
    },
  ],
});
