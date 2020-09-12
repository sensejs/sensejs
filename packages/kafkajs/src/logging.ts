import {LogEntry, logLevel} from 'kafkajs';
import {KafkaLogOption} from '@sensejs/kafkajs-standalone';
import {LoggerBuilder} from '@sensejs/core';

export type KafkaLogLevel = 'NOTHING' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

export interface KafkaLogAdapterOption {
  level?: KafkaLogLevel;
  labelPrefix?: string;
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

export function createLogOption(
  loggerBuilder: LoggerBuilder,
  option: KafkaLogAdapterOption = {},
): Required<KafkaLogOption> {
  const {level: desiredLevel = 'WARN', labelPrefix = 'KafkaJS'} = option;
  return {
    level: logLevel[desiredLevel],
    logCreator: (level: number) => {
      return (logEntry: LogEntry) => {
        if (level <= logEntry.level) {
          const {timestamp, message, ...rest} = logEntry.log;
          const label = [labelPrefix, logEntry.namespace].filter((x) => !!x).join(':');
          const logger = loggerBuilder.build(label);
          logger[adaptLogLevel(logEntry.level)](`${message}\nDetail:`, rest);
          if (level <= logLevel.DEBUG) {
            logger.debug('Detail: ', rest);
          }
        }
      };
    },
  };
}
