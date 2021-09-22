import {Kafka} from 'kafkajs';
import {KafkaClientOption} from './types.js';
import {consoleLogger} from '@sensejs/utility';
import {createLogOption} from './logging.js';

export function createKafkaClient(clientOption: KafkaClientOption): Kafka {
  const {
    connectOption: {brokers, ...kafkaConfig},
    logOption = {},
    logger = consoleLogger,
  } = clientOption;
  return new Kafka({
    brokers: typeof brokers === 'string' ? brokers.split(',') : brokers,
    ...createLogOption(logger, logOption),
    ...kafkaConfig,
  });
}
