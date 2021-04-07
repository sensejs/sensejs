import {Kafka} from 'kafkajs';
import {KafkaClientOption} from './types';
import {consoleLogger} from '@sensejs/utility';
import {createLogOption} from './logging';

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
