import {LogEntry, logLevel} from 'kafkajs';
import {KafkaLogOption} from './types.js';
import {Logger} from '@sensejs/utility';

export type KafkaLogLevel = 'NOTHING' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

export interface KafkaLogAdapterOption {
  level?: KafkaLogLevel;
}

function adaptLogLevel(level: logLevel) {
  switch (level) {
    case logLevel.ERROR:
      return 'error';
    case logLevel.WARN:
      return 'warn';
    case logLevel.INFO:
      return 'info';
    case logLevel.DEBUG:
      return 'debug';
    case logLevel.NOTHING:
    default:
      return '';
  }
}

export function createLogOption(logger: Logger, option: KafkaLogAdapterOption = {}): Required<KafkaLogOption> {
  const {level: desiredLevel = 'INFO'} = option;
  return {
    level: logLevel[desiredLevel],
    logCreator: () => {
      return (logEntry: LogEntry) => {
        if (logLevel[desiredLevel] >= logEntry.level) {
          const {timestamp, message, ...rest} = logEntry.log;
          const level = adaptLogLevel(logEntry.level);
          if (level) {
            logger[level](`${message}\nDetail:`, rest);
          }
        }
      };
    },
  };
}
