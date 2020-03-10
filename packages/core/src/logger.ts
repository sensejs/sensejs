import {Class} from './interfaces';
import {Inject, Optional} from './decorators';
import {consoleLogger, DecoratorBuilder, Logger} from '@sensejs/utility';

export {consoleLogger, Logger} from '@sensejs/utility';


export abstract class LoggerBuilder {
  abstract build(loggerLabel: string): Logger;
}

/**
 * @deprecated
 */
export const LOGGER_BUILDER_SYMBOL = LoggerBuilder;

export function InjectLogger(name?: string | Function) {
  const labelName = typeof name === 'function' ? name.name : typeof name === 'string' ? name : '';
  const option = {
    transform: (builder?: LoggerBuilder) => builder?.build(labelName) ?? consoleLogger,
  };
  return new DecoratorBuilder('InjectLogger')
    .whenApplyToConstructorParam(<T extends Class>(target: T, index: number) => {
      Optional()(target, undefined, index);
      Inject(LoggerBuilder, option)(target, undefined, index);
    })
    .whenApplyToInstanceMethodParam(<T extends {}>(target: T, name: (string | symbol), index: number) => {
      Optional()(target, name, index);
      Inject(LoggerBuilder, option)(target, name, index);
    })
    .build();
}
