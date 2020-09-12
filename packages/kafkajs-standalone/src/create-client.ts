import {Kafka} from 'kafkajs';
import {KafkaClientOption, KafkaConnectOption, KafkaLogOption} from './types';

export function createKafkaClient(clientOption: KafkaClientOption): Kafka {
  const {
    connectOption: {brokers, ...kafkaConfig},
    logOption = {},
  } = clientOption;
  return new Kafka({
    brokers: typeof brokers === 'string' ? brokers.split(',') : brokers,
    ...logOption,
    ...kafkaConfig,
  });
}
