import {Module} from './module';
import {default as loggerFactory, Logger as LoggerInterface} from '@sensejs/logger';
import {ComponentFactory, ComponentFactoryContext} from './interfaces';
import {inject, optional} from 'inversify';

export const TraceId = Symbol();
const LoggerSymbol = Symbol();
export const InjectLogger = inject(LoggerSymbol);


export class LoggerFactory extends ComponentFactory<LoggerInterface> {

    @inject(TraceId)
    @optional()
    private traceId?: string;


    build(context: ComponentFactoryContext): LoggerInterface {
        const parentRequest = context.currentRequest.parentRequest;

        const parent = parentRequest ? parentRequest.serviceIdentifier : null;
        const moduleName = parent === null ? '' :
            typeof parent === 'symbol' ? parent.toString() :
                typeof parent === 'string' ? parent : (parent as Function).name;

        return loggerFactory(moduleName, this.traceId);
    }
}

export const LoggerModule = Module({
    factories: [{
        provide: LoggerSymbol,
        factory: LoggerFactory
    }]
});

