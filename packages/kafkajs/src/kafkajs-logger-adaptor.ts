import {LogEntry, logLevel} from 'kafkajs';
import {ConsoleLoggerBuilder, LoggerBuilder} from '@sensejs/core';

export type KafkaLogLevel = 'NOTHING' | 'ERROR' | 'WARNING' | 'INFO' | 'DEBUG';

export interface KafkaLogOption {
  level: KafkaLogLevel;
  loggerBuilder: LoggerBuilder;
  labelPrefix?: string;
}

interface KafkaJsLoggingOption {
  level: logLevel;
  logCreator: (level: string | number) => ((logEntry: LogEntry) => void);
}

function adaptLogLevel(level: logLevel) {
  switch (level) {
    case logLevel.WARN:
      return 'warn';
    case logLevel.INFO:
      return 'info';
    case logLevel.DEBUG:
      return 'debug';
    case logLevel.ERROR:
    case logLevel.NOTHING:
    default:
      return 'error';
  }
}

export function createLogOption(option?: KafkaLogOption): KafkaJsLoggingOption {

  if (option === undefined) {
    return {
      level: 0,
      logCreator: () => () => void 0,
    };
  }

  const {level: desiredLevel = 'WARNING', labelPrefix = 'KafkaJS', loggerBuilder = new ConsoleLoggerBuilder()} = option;

  // Typings file for kafkajs incorrectly defined log related types, need cast
  return {
    // @ts-ignore
    level: logLevel[desiredLevel],
    logCreator: (level: string | number) => {
      // @ts-ignore
      const filteredLevel = typeof level === 'string' ? logLevel[level] : level;
      return (logEntry: LogEntry) => {
        if (filteredLevel <= logEntry.level) {
          const {timestamp, message, ...rest} = logEntry.log;
          const label = [labelPrefix, logEntry.namespace].filter((x) => !!x).join(':');
          const logger = loggerBuilder.build(label);
          logger[adaptLogLevel(logEntry.level)](`${message}\nDetail:`, rest);
          if (filteredLevel <= logLevel.DEBUG) {
            logger.debug('Detail: ', rest);
          }
        }
      };
    },
  };
}
