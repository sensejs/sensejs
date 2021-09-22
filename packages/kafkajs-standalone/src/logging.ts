import kafkajs from 'kafkajs';
import {KafkaLogOption} from './types.js';
import {Logger} from '@sensejs/utility';

export type KafkaLogLevel = 'NOTHING' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

export interface KafkaLogAdapterOption {
  level?: KafkaLogLevel;
}

function adaptLogLevel(level: kafkajs.logLevel) {
  switch (level) {
    case kafkajs.logLevel.ERROR:
      return 'error';
    case kafkajs.logLevel.WARN:
      return 'warn';
    case kafkajs.logLevel.INFO:
      return 'info';
    case kafkajs.logLevel.DEBUG:
      return 'debug';
    case kafkajs.logLevel.NOTHING:
    default:
      return '';
  }
}

export function createLogOption(logger: Logger, option: KafkaLogAdapterOption = {}): Required<KafkaLogOption> {
  const {level: desiredLevel = 'INFO'} = option;
  return {
    level: kafkajs.logLevel[desiredLevel],
    logCreator: () => {
      return (logEntry: kafkajs.LogEntry) => {
        if (kafkajs.logLevel[desiredLevel] >= logEntry.level) {
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
