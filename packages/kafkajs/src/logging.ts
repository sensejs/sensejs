import {LogEntry, logLevel} from 'kafkajs';
import {KafkaLogOption} from '@sensejs/kafkajs-standalone';
import {Logger} from '@sensejs/utility';

export type KafkaLogLevel = 'NOTHING' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

export interface KafkaLogAdapterOption {
  level: KafkaLogLevel;
  loggerBuilder?: (label: string) => Logger;
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

export function createLogOption(option?: KafkaLogAdapterOption): Required<KafkaLogOption> {
  if (typeof option === 'undefined' || typeof option.loggerBuilder === 'undefined') {
    return {
      level: 0,
      logCreator: () => () => void 0,
    };
  }

  const {level: desiredLevel = 'WARN', labelPrefix = 'KafkaJS', loggerBuilder} = option;
  return {
    level: logLevel[desiredLevel],
    logCreator: (level: number) => {
      return (logEntry: LogEntry) => {
        if (level <= logEntry.level) {
          const {timestamp, message, ...rest} = logEntry.log;
          const label = [labelPrefix, logEntry.namespace].filter((x) => !!x).join(':');
          const logger = loggerBuilder(label);
          logger[adaptLogLevel(logEntry.level)](`${message}\nDetail:`, rest);
          if (level <= logLevel.DEBUG) {
            logger.debug('Detail: ', rest);
          }
        }
      };
    },
  };
}
