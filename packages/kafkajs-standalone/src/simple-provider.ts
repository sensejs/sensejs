import {SimpleKafkaJsMessageProducer} from './simple-message-producer.js';
import kafkajs from 'kafkajs';
import {KafkaJsTransactionalMessageProducer} from './transactional-message-producer.js';
import {MessageProducerOption, MessageProducerProvider} from './types.js';
import {createKafkaClient} from './create-client.js';

export class SimpleKafkaJsProducerProvider extends MessageProducerProvider {
  private allProducerClosed: Promise<any> = Promise.resolve();
  private client: kafkajs.Kafka;

  constructor(private option: MessageProducerOption) {
    super();
    this.client = createKafkaClient(option);
  }

  async create() {
    const producer = this.client.producer(this.option.producerOption);
    try {
      await producer.connect();
      return new SimpleKafkaJsMessageProducer(this.option.sendOption ?? {}, producer, async () => {
        this.allProducerClosed = Promise.all([this.allProducerClosed, producer.disconnect()]);
      });
    } catch (e) {
      await producer.disconnect();
      throw e;
    }
  }

  async createTransactional(transactionalId: string) {
    const producer = this.client.producer({
      ...this.option.producerOption,
      transactionalId,
      maxInFlightRequests: 1,
      idempotent: true,
    });
    try {
      await producer.connect();
      return new KafkaJsTransactionalMessageProducer(this.option.sendOption ?? {}, producer, async () => {
        this.allProducerClosed = Promise.all([this.allProducerClosed, producer.disconnect()]);
      });
    } catch (e) {
      await producer.disconnect();
      throw e;
    }
  }

  async destroy() {
    await this.allProducerClosed;
  }
}
