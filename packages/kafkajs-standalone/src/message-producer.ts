import {Kafka, Partitioners, Producer, RecordMetadata, Sender, TopicMessages} from 'kafkajs';
import {KafkaConnectOption, KafkaMessage, KafkaProducerOption, KafkaSendOption} from './types';
import {createLogOption, KafkaLogOption} from './kafkajs-logger-adaptor';

export interface MessageProducerConfig {
  connectOption: KafkaConnectOption;
  logOption?: KafkaLogOption;
  producerOption?: KafkaProducerOption;
  sendOption?: KafkaSendOption;
}

export class MessageProducer {
  private client: Kafka;
  private producer?: Producer;
  private connectPromise?: Promise<void>;
  private disconnectPromise: Promise<void> = Promise.resolve();
  private allMessageSend: Promise<unknown> = Promise.resolve();

  constructor(private option: MessageProducerConfig) {
    const {logOption, producerOption = {}} = option;
    const kafkaOption = {...createLogOption(logOption), ...option.connectOption};
    this.client = new Kafka(kafkaOption);
  }

  async connect() {
    if (this.connectPromise) {
      return this.connectPromise;
    }
    this.producer = this.client.producer({
      ...this.option.producerOption,
      createPartitioner: Partitioners.JavaCompatiblePartitioner,
    });
    this.connectPromise = this.producer.connect();
    return this.connectPromise;
  }

  /**
   * Send message(s) to one topic
   *
   * @param topic
   * @param messages
   */
  async send(topic: string, messages: KafkaMessage[] | KafkaMessage) {
    if (!this.producer) {
      throw new Error('producer is not connected');
    }
    const promise = this.producer.send({
      ...this.option.sendOption,
      topic,
      messages: Array.isArray(messages) ? messages : [messages],
    });

    this.allMessageSend = this.allMessageSend.then(() => promise.catch(() => void 0));
    return promise;
  }

  /**
   * Send batched messages. And ensure messages to be sent in one transaction if required
   *
   * @param topicMessage
   * @param transactional
   *
   * @beta
   */
  async sendBatch(topicMessage: TopicMessages[], transactional = true) {
    if (!this.producer) {
      throw new Error('producer is not connected');
    }
    const promise = this.performSendBatch(this.producer, topicMessage, transactional);
    this.allMessageSend = this.allMessageSend.then(() => promise.catch(() => void 0));
    return promise;
  }

  private async performSendBatch(producer: Producer, topicMessage: TopicMessages[], transactional = true) {
    if (!transactional) {
      return this.internalSendBatch(topicMessage, producer);
    }
    const sender = await producer.transaction();
    let error;
    try {
      return await this.internalSendBatch(topicMessage, sender);
    } catch (e) {
      error = e || new Error('unknown error');
      throw e;
    } finally {
      if (typeof error === 'undefined') {
        await sender.commit();
      } else {
        await sender.abort();
      }
    }
  }

  async disconnect() {
    const producer = this.producer;
    if (!producer) {
      return this.disconnectPromise;
    }
    delete this.producer;

    this.disconnectPromise = this.allMessageSend.then(() => {
      return producer.disconnect();
    });
    return this.disconnectPromise;
  }

  private async internalSendBatch(topicMessages: TopicMessages[], sender: Sender) {

    let result: RecordMetadata[] = [];
    for (const {topic, messages} of topicMessages) {
      result = result.concat(await sender.send({...this.option.sendOption, topic, messages}));
    }
    return result;
  }

}
