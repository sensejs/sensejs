/* tslint:disable no-console */
import {Module} from './module';
import {Class, ComponentFactory, ComponentFactoryContext, ComponentScope} from './interfaces';
import {targetName} from 'inversify';
import {Component} from './component';
import {Inject, Optional} from './decorators';
import {DecoratorBuilder} from './utils';
import {ensureMethodInjectMetadata} from './method-inject';

const LOGGER_SYMBOL = Symbol('LOGGER_SYMBOL');
export const LOGGER_BUILDER_SYMBOL = Symbol('LOGGER_BUILDER_SYMBOL');

export function InjectLogger(name?: string | Function) {
  const labelName = typeof name === 'function' ? name.name : typeof name === 'string' ? name : '';
  return new DecoratorBuilder('InjectLogger')
    .whenApplyToConstructorParam(<T extends Class>(target: T, index: number) => {
      Inject(LOGGER_SYMBOL)(target, undefined, index);
      // @ts-ignore
      targetName(labelName)(target, undefined, index);
    })
    .whenApplyToInstanceMethodParam(<T extends {}>(target: T, name: (string | symbol), index: number) => {
      const metadata = ensureMethodInjectMetadata(Reflect.get(target, name));
      Inject(LOGGER_SYMBOL)(target, name, index);
      // @ts-ignore
      targetName(labelName)(metadata.proxy, undefined, index);
    })
    .build();
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
    @Inject(LOGGER_BUILDER_SYMBOL)
    @Optional()
    private loggerBuilder: LoggerBuilder = new ConsoleLoggerBuilder(),
  ) {
    super();
  }

  build(context: ComponentFactoryContext): Logger {
    const parentRequest = context.currentRequest.parentRequest;
    let moduleName = context.currentRequest.target.name.value();

    const parent = parentRequest ? parentRequest.serviceIdentifier : null;
    if (!moduleName) {
      moduleName = parent === null
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
