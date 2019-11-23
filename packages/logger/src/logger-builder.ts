import {LogLevel, LogTransport} from './definition';
import {StreamLogTransport} from './stream-log-transport';
import {Logger} from '@sensejs/core';

const MODULE_NAME_RULE = /^[_a-zA-Z][-.=_0-9a-zA-Z]{0,31}$/;
const TRACE_ID_RULE = /^[-.+/=_a-zA-Z0-9]{0,36}$/;

function createLogger(logTransports: LogTransport[], label: string, traceId: string = ''): Logger {
  if (label !== '' && !MODULE_NAME_RULE.test(label)) {
    throw new Error('Invalid label');
  }

  if (traceId !== '' && !TRACE_ID_RULE.test(traceId)) {
    throw new Error('Invalid trace id');
  }

  const doLog = (level: LogLevel) => {
    const timestamp = Date.now();
    return (...messages: [unknown, ...unknown[]]) => {
      logTransports.forEach((transport) =>
        transport.write({
          timestamp,
          level,
          label,
          traceId,
          messages,
        }),
      );
    };
  };

  return {
    trace: doLog(LogLevel.TRACE),
    debug: doLog(LogLevel.DEBUG),
    info: doLog(LogLevel.INFO),
    log: doLog(LogLevel.INFO),
    warn: doLog(LogLevel.WARN),
    error: doLog(LogLevel.ERROR),
    fatal: doLog(LogLevel.FATAL),
  };
}

/**
 * Simple Log Factory
 */
export class SenseLoggerBuilder {
  constructor(private label: string = '', private traceId: string = '', private logTransports: LogTransport[]) {}

  setLabel(label: string) {
    return new SenseLoggerBuilder(label, this.traceId, this.logTransports);
  }

  setTraceId(traceId: string) {
    return new SenseLoggerBuilder(this.label, traceId, this.logTransports);
  }

  resetLogTransports() {
    return new SenseLoggerBuilder(this.label, this.traceId, []);
  }

  addLogTransports(transport: LogTransport) {
    return new SenseLoggerBuilder(this.label, this.traceId, this.logTransports.concat([transport]));
  }

  build(label?: string): Logger {
    return createLogger(this.logTransports, label ?? this.label, this.traceId);
  }
}

export const defaultLoggerBuilder = new SenseLoggerBuilder('', '', [
  new StreamLogTransport(process.stdout, [LogLevel.TRACE, LogLevel.DEBUG, LogLevel.INFO]),
  new StreamLogTransport(process.stderr, [LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL]),
]);
