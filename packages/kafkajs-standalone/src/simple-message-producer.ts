import {Sender} from 'kafkajs';
import {KafkaSendOption} from './types.js';
import {BaseKafkaJsMessageProducer} from './base-message-producer.js';

export class SimpleKafkaJsMessageProducer extends BaseKafkaJsMessageProducer {
  constructor(option: KafkaSendOption, private producer: Sender, onRelease: (e?: Error) => Promise<void>) {
    super(option, onRelease);
  }

  isActive() {
    return typeof this.onRelease !== 'undefined';
  }

  protected async sender() {
    return this.producer;
  }
}
