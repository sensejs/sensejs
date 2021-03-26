import {Class, Transformer} from './interfaces';
import {Inject, InjectionDecorator, Optional} from './decorators';
import {consoleLogger, DecoratorBuilder, Logger} from '@sensejs/utility';

export {consoleLogger, Logger} from '@sensejs/utility';

export abstract class LoggerBuilder {
  abstract build(loggerLabel: string): Logger;
}

export const LOGGER_BUILDER_SYMBOL = LoggerBuilder;

function loggerTransformer(label: string): Transformer<LoggerBuilder | undefined, Logger> {
  return (builder?: LoggerBuilder) => {
    return builder?.build(label) ?? consoleLogger;
  };
}

export function InjectLogger(name?: string | Function): InjectionDecorator;

export function InjectLogger(...args: any[]): InjectionDecorator {
  const name = args[0];
  const labelName = typeof name === 'function' ? name.name : typeof name === 'string' ? name : undefined;
  if (typeof labelName === 'undefined' && args.length > 0) {
    throw new TypeError(`Invalid param of type "${typeof name}" for ${InjectLogger.name}`);
  }

  return new DecoratorBuilder('InjectLogger')
    .whenApplyToConstructorParam(<T extends Class>(target: T, index: number) => {
      Optional()(target, undefined, index);
      return Inject(LoggerBuilder, {
        transform: loggerTransformer(labelName ?? target.name ?? ''),
      })(target, undefined, index);
    })
    .whenApplyToInstanceMethodParam(<T extends {}>(target: T, name: keyof T, index: number) => {
      Optional()(target, name, index);
      Inject(LoggerBuilder, {
        transform: loggerTransformer(labelName ?? target.constructor.name ?? ''),
      })(target, name, index);
    })
    .build();
}
