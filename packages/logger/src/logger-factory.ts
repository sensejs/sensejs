import {Logger, LogLevel, LogTransport, RawLogData} from './definition';
import {StreamLogTransport} from './stream-log-transport';

const MODULE_NAME_RULE = /^[_a-zA-Z][-_0-9a-zA-Z]{0,31}$/;
const TRACE_ID_RULE = /^[-+/_a-zA-Z0-9]{0,36}$/;

function createLogger(logTransports: LogTransport[], initModuleName: string, initTraceId: string = ''): Logger {

    return function deriveLogger(this: void, moduleName: string, traceId: string): Logger {
        if (traceId && !TRACE_ID_RULE.test(traceId)) {
            throw new Error(`Invalid traceId, need to match regexp ${TRACE_ID_RULE}`);
        }
        const doLog = (rawLogData: RawLogData) => {
            logTransports.forEach((transport) => transport.write(rawLogData));
        };
        const logger = (newModuleName: string | null, newTraceId?: string): Logger => {
            return deriveLogger(newModuleName || moduleName, newTraceId ? newTraceId : traceId);
        };

        return Object.assign(logger, {
            trace: (...messages: [unknown, ...unknown[]]) => {
                return doLog({
                    timestamp: Date.now(),
                    level: LogLevel.TRACE,
                    module: moduleName,
                    traceId,
                    messages
                })
            },
            debug: (...messages: [unknown, ...unknown[]]) => {
                return doLog({
                    timestamp: Date.now(),
                    level: LogLevel.DEBUG,
                    module: moduleName,
                    traceId,
                    messages
                });
            },

            info: (...messages: [unknown, ...unknown[]]) => {
                doLog({
                    timestamp: Date.now(),
                    level: LogLevel.INFO,
                    module: moduleName,
                    traceId,
                    messages
                });
            },

            log: (...messages: [unknown, ...unknown[]]) => {
                doLog({
                    timestamp: Date.now(),
                    level: LogLevel.INFO,
                    module: moduleName,
                    traceId,
                    messages
                });
            },

            warn: (...messages: [unknown, ...unknown[]]) => {
                doLog({
                    timestamp: Date.now(),
                    level: LogLevel.WARN,
                    module: moduleName,
                    traceId,
                    messages
                });
            },

            error: (...messages: [unknown, ...unknown[]]) => {
                doLog({
                    timestamp: Date.now(),
                    level: LogLevel.ERROR,
                    module: moduleName,
                    traceId,
                    messages
                });
            },

            fatal: (...messages: [unknown, ...unknown[]]) => {
                doLog({
                    timestamp: Date.now(),
                    level: LogLevel.FATAL,
                    module: moduleName,
                    traceId,
                    messages
                });
            }
        });
    }(initModuleName, initTraceId);
}

/**
 * Simple Log Factory
 */
export class LoggerFactory {

    constructor(private _module: string,
                private _logTransports: LogTransport[] = []) {
    }

    setModuleName(label: string) {
        if (!MODULE_NAME_RULE.test(label)) {
            throw new Error(`Invalid log label, need to match regexp ${MODULE_NAME_RULE}`);
        }
        return new LoggerFactory(label, this._logTransports);
    }

    build(initTraceId?: string): Logger {
        return createLogger(this._logTransports, this._module, initTraceId);
    }

    getLogTransports(): LogTransport[] {
        return this._logTransports;
    }
}

export default new LoggerFactory('', [
    new StreamLogTransport(process.stdout, [LogLevel.TRACE, LogLevel.DEBUG, LogLevel.INFO]),
    new StreamLogTransport(process.stderr, [LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL]),
]).build();
