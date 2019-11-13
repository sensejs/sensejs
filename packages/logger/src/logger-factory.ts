import {Logger, LogLevel, LogTransport} from './definition';
import {StreamLogTransport} from './stream-log-transport';

const MODULE_NAME_RULE = /^[_a-zA-Z][-.=_0-9a-zA-Z]{0,31}$/;
const TRACE_ID_RULE = /^[-.+/=_a-zA-Z0-9]{0,36}$/;

function createLogger(logTransports: LogTransport[], initModuleName: string, initTraceId: string = ''): Logger {
  return (function deriveLogger(this: void, moduleName: string, traceId: string): Logger {
    if (moduleName && !MODULE_NAME_RULE.test(moduleName)) {
      throw new Error(`Invalid module name, need to match regexp ${MODULE_NAME_RULE}`);
    }
    if (traceId && !TRACE_ID_RULE.test(traceId)) {
      throw new Error(`Invalid traceId, need to match regexp ${TRACE_ID_RULE}`);
    }
    const doLog = (level: LogLevel) => {
      const timestamp = Date.now();
      return (...messages: [unknown, ...unknown[]]) => {
        logTransports.forEach((transport) =>
          transport.write({
            timestamp,
            level,
            module: moduleName,
            traceId,
            messages,
          }),
        );
      };
    };
    const logger = (newModuleName: string | null, newTraceId?: string): Logger => {
      return deriveLogger(newModuleName || moduleName, newTraceId ? newTraceId : traceId);
    };

    return Object.assign(logger, {
      trace: doLog(LogLevel.TRACE),
      debug: doLog(LogLevel.DEBUG),
      info: doLog(LogLevel.INFO),
      log: doLog(LogLevel.INFO),
      warn: doLog(LogLevel.WARN),
      error: doLog(LogLevel.ERROR),
      fatal: doLog(LogLevel.FATAL),
    });
  })(initModuleName, initTraceId);
}

/**
 * Simple Log Factory
 */
export class LoggerFactory {
  constructor(private _module: string, private _logTransports: LogTransport[] = []) {}

  setModuleName(label: string) {
    return new LoggerFactory(label, this._logTransports);
  }

  build(initTraceId?: string): Logger {
    return createLogger(this._logTransports, this._module, initTraceId);
  }

  getLogTransports(): LogTransport[] {
    return this._logTransports;
  }
}

export const defaultLoggerFactory = new LoggerFactory('', [
  new StreamLogTransport(process.stdout, [LogLevel.TRACE, LogLevel.DEBUG, LogLevel.INFO]),
  new StreamLogTransport(process.stderr, [LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL]),
]);
