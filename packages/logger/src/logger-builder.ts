import {LogLevel, LogTransport} from './definition';
import {StreamLogTransport} from './stream-log-transport';
import {Logger, LoggerBuilder} from '@sensejs/core';

const MODULE_NAME_RULE = /^[^<>{}*'"`]{0,80}$/;
const TRACE_ID_RULE = /^[^<>{}*'"`]{0,80}$/;

function createLogger(logTransports: LogTransport[], label: string, traceId: string = ''): Logger {
  if (label !== '' && !MODULE_NAME_RULE.test(label)) {
    throw new Error('Invalid label: ' + label);
  }

  if (traceId !== '' && !TRACE_ID_RULE.test(traceId)) {
    throw new Error('Invalid trace id: ' + traceId);
  }

  const doLog = (level: LogLevel) => {
    return (...messages: [unknown, ...unknown[]]) => {
      const timestamp = Date.now();
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
export class SenseLoggerBuilder extends LoggerBuilder {
  constructor(private logTransports: LogTransport[], private label = '', private traceId = '') {
    super();
  }

  setLabel(label: string) {
    return new SenseLoggerBuilder(this.logTransports, label, this.traceId);
  }

  setTraceId(traceId: string) {
    return new SenseLoggerBuilder(this.logTransports, this.label, traceId);
  }

  resetLogTransports() {
    return new SenseLoggerBuilder([], this.label, this.traceId);
  }

  addLogTransports(transport: LogTransport) {
    return new SenseLoggerBuilder(this.logTransports.concat([transport]), this.label, this.traceId);
  }

  build(label?: string): Logger {
    return createLogger(this.logTransports, label ?? this.label, this.traceId);
  }
}

export const defaultLoggerBuilder = new SenseLoggerBuilder([
  new StreamLogTransport(process.stdout, [LogLevel.TRACE, LogLevel.DEBUG, LogLevel.INFO]),
  new StreamLogTransport(process.stderr, [LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL]),
]);
