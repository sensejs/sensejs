import type {Message, RecordMetadata, Sender, TopicMessages} from 'kafkajs';
import {KafkaSendOption, SimpleMessageProducer} from './types.js';

export abstract class BaseKafkaJsMessageProducer implements SimpleMessageProducer {
  protected allMessageSend?: Promise<unknown>;
  protected onRelease?: (e?: Error) => void;

  constructor(private option: KafkaSendOption, onRelease: (e?: Error) => Promise<void>) {
    this.onRelease = onRelease;
  }

  protected abstract sender(): Promise<Sender>;

  protected checkReleased() {
    if (!this.isActive()) {
      throw new Error('This message producer has been released');
    }
  }

  isActive() {
    return typeof this.onRelease !== 'undefined';
  }

  /**
   * Send message(s) to one topic
   *
   * @param topic
   * @param message
   */
  async sendMessage(topic: string, message: Message): Promise<RecordMetadata> {
    this.checkReleased();
    const producer = await this.sender();
    const promise = producer.send({
      ...this.option,
      topic,
      messages: [message],
    });

    this.allMessageSend = Promise.resolve(this.allMessageSend).then(() =>
      promise.catch((e) => this.internalRelease(e)),
    );
    return promise.then(([recordMetadata]) => recordMetadata);
  }

  /**
   * Send batched messages.
   */
  async sendMessageBatch(...args: [string, Message[]] | [TopicMessages[]]): Promise<RecordMetadata[]> {
    this.checkReleased();
    const producer = await this.sender();
    if (args.length === 1) {
      const promise = producer.sendBatch({...this.option, topicMessages: args[0]});
      promise.catch((e) => this.internalRelease(e));
      this.allMessageSend = Promise.resolve(this.allMessageSend).then(() =>
        promise.catch((e) => this.internalRelease(e)),
      );
      return promise;
    } else {
      const promise = producer.send({
        ...this.option,
        topic: args[0],
        messages: args[1],
      });
      this.allMessageSend = Promise.resolve(this.allMessageSend).then(() =>
        promise.catch((e) => this.internalRelease(e)),
      );
      return promise;
    }
  }

  protected async internalRelease(e?: Error) {
    if (this.onRelease) {
      const onRelease = this.onRelease;
      delete this.onRelease;
      return Promise.resolve(this.allMessageSend).finally(() => onRelease(e));
    }
  }

  async release() {
    await this.internalRelease();
  }
}
