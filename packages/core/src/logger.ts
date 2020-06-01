import {Class, Constructor} from './interfaces';
import {Inject, Optional} from './decorators';
import {
  consoleLogger,
  ConstructorParamDecorator,
  DecoratorBuilder,
  InstanceMethodParamDecorator,
  Logger,
  Transformer,
} from '@sensejs/utility';

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

interface InjectLoggerDecorator extends ConstructorParamDecorator, InstanceMethodParamDecorator {}

export function InjectLogger(name?: string | Function) {
  const labelName = typeof name === 'function' ? name.name : typeof name === 'string' ? name : undefined;
  return new DecoratorBuilder('InjectLogger')
    .whenApplyToConstructorParam(<T extends Class>(target: T, index: number) => {
      Optional()(target, undefined, index);
      return Inject(LoggerBuilder, {
        transform: loggerTransformer(labelName ?? target.name ?? ''),
      })(target, undefined, index);
    })
    .whenApplyToInstanceMethodParam(<T extends {}>(target: T, name: (string | symbol), index: number) => {
      Optional()(target, name, index);
      Inject(LoggerBuilder, {
        transform: loggerTransformer(labelName ?? target.constructor.name ?? ''),
      })(target, name, index);
    })
    .build();
}
