import {Module} from './module';
import {Logger as LoggerInterface} from '@sensejs/logger';
import {default as loggerFactory} from '@sensejs/logger/lib/logger-factory';
import {Component, ComponentFactory, ComponentFactoryContext, ComponentScope} from './component';
import uuid from 'uuid/v4';
import {inject, optional} from 'inversify';

/**
 * Abstract logger class, also used as inject token
 */
export abstract class Logger {
    abstract log(...args: [unknown, ...unknown[]]): void;

    abstract info(...args: [unknown, ...unknown[]]): void;

    abstract error(...args: [unknown, ...unknown[]]): void;

    abstract warn(...args: [unknown, ...unknown[]]): void;

    abstract debug(...args: [unknown, ...unknown[]]): void;

    abstract trace(...args: [unknown, ...unknown[]]): void;

    abstract fatal(...args: [unknown, ...unknown[]]): void;
}

class LoggerImplementation extends Logger {
    constructor(private logger: LoggerInterface) {
        super();
    }

    debug(...args: [unknown, unknown[]]) {
        this.logger.debug(...args);
    }

    error(...args: [unknown, unknown[]]) {
        this.logger.error(...args);
    }

    fatal(...args: [unknown, unknown[]]) {
        this.logger.fatal(...args);
    }

    info(...args: [unknown, unknown[]]) {
        this.logger.info(...args);
    }

    log(...args: [unknown, unknown[]]) {
        this.logger.log(...args);
    }

    trace(...args: [unknown, unknown[]]) {
        this.logger.trace(...args);
    }

    warn(...args: [unknown, unknown[]]) {
        this.logger.warn(...args);
    }

}

/**
 * TraceId Inject token
 *
 * TraceId is an optional dependency of LoggerFactory, client-side code
 * can bind TraceId to any value to trace all log
 */
export class TraceId {
}

@Component.Factory({provide: TraceId, scope: ComponentScope.REQUEST})
class TraceIdFactory extends ComponentFactory<String> {

    private uuid = uuid();

    build(context: ComponentFactoryContext): String {
        return this.uuid;
    }
}

class BaseLogger {
}

@Component.Factory({provide: BaseLogger, scope: ComponentScope.REQUEST})
class BaseFactory extends ComponentFactory<String> {

    private uuid = uuid();

    build(context: ComponentFactoryContext): String {
        return this.uuid;
    }
}


@Component.Factory({provide: Logger, scope: ComponentScope.REQUEST})
class LoggerFactory extends ComponentFactory<Logger> {

    @inject(TraceId)
    @optional()
    private traceId?: string;


    build(context: ComponentFactoryContext): Logger {
        const parentRequest = context.currentRequest.parentRequest;

        const parent = parentRequest ? parentRequest.serviceIdentifier : null;
        const moduleName = parent === null ? '' :
            typeof parent === 'symbol' ? parent.toString() :
                typeof parent === 'string' ? parent : (parent as Function).name;

        return new LoggerImplementation(loggerFactory(moduleName, this.traceId));
    }
}

export class LoggerModule extends Module({components: [LoggerFactory]}) {

}
