import {Module} from './module';
import {defaultLoggerFactory, Logger as LoggerInterface, LoggerFactory} from '@sensejs/logger';
import {ComponentFactory, ComponentFactoryContext} from './interfaces';
import {inject, optional} from 'inversify';

export const TraceId = Symbol();
export const LoggerFactorySymbol = Symbol();
const LoggerSymbol = Symbol();
export const InjectLogger = inject(LoggerSymbol);

export class LoggerBuilder extends ComponentFactory<LoggerInterface> {
  @inject(TraceId)
  @optional()
  private traceId?: string;

  @inject(LoggerFactorySymbol)
  @optional()
  private loggerFactory: LoggerFactory = defaultLoggerFactory;

  build(context: ComponentFactoryContext): LoggerInterface {
    const parentRequest = context.currentRequest.parentRequest;

    const parent = parentRequest ? parentRequest.serviceIdentifier : null;
    const moduleName =
      parent === null
        ? ''
        : typeof parent === 'symbol'
        ? parent.toString()
        : typeof parent === 'string'
        ? parent
        : typeof parent === 'function'
        ? parent.name
        : '';

    return this.loggerFactory.setModuleName(moduleName).build(this.traceId);
  }
}

export const LoggerModule = Module({
  factories: [
    {
      provide: LoggerSymbol,
      factory: LoggerBuilder,
    },
  ],
});
