import {Class, ComponentFactory, ComponentFactoryContext, ComponentScope} from './interfaces';
import {targetName, interfaces} from 'inversify';
import {Component} from './component';
import {Inject, Optional} from './decorators';
import {consoleLogger, DecoratorBuilder, Logger} from '@sensejs/utility';
import {ensureMethodInjectMetadata} from './method-inject';
import {createModule} from './module';

export {consoleLogger, Logger} from '@sensejs/utility';

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

export interface LoggerBuilder {
  build(loggerLabel: string): Logger;
}

@Component()
export class ConsoleLoggerBuilder implements LoggerBuilder {
  build(): Logger {
    return consoleLogger;
  }
}

function getLoggerNameFromRequest(parentRequest: interfaces.Request | null) {
  const parent = parentRequest ? parentRequest.serviceIdentifier : null;
  return parent === null
    ? ''
    : typeof parent === 'symbol'
      ? parent.toString()
      : typeof parent === 'string'
        ? parent
        : typeof parent === 'function'
          ? parent.name
          : '';
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
    const moduleName = context.currentRequest.target.name.value() ?? getLoggerNameFromRequest(parentRequest);
    return this.loggerBuilder.build(moduleName);
  }
}

export const LoggerModule = createModule({
  factories: [
    {
      provide: LOGGER_SYMBOL,
      factory: LoggerFactory,
      scope: ComponentScope.TRANSIENT,
    },
  ],
});
