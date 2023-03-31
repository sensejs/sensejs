import {KafkaSendOption, TransactionalMessageProducer} from './types.js';
import type {Offsets, Producer, Transaction} from 'kafkajs';
import {BaseKafkaJsMessageProducer} from './base-message-producer.js';

export class KafkaJsTransactionalMessageProducer
  extends BaseKafkaJsMessageProducer
  implements TransactionalMessageProducer
{
  #tx: Transaction | null = null;
  constructor(option: KafkaSendOption, private producer: Producer, onRelease: (e?: Error) => Promise<void>) {
    super(option, onRelease);
  }

  protected async sender() {
    if (this.#tx) {
      return this.#tx;
    }
    this.#tx = await this.producer.transaction();
    return this.#tx;
  }

  async sendOffset(consumerGroupId: string, offsets: Offsets) {
    this.checkReleased();
    const producer = await this.sender();
    const promise = producer.sendOffsets({consumerGroupId, ...offsets});
    this.allMessageSend = Promise.resolve(this.allMessageSend).then(() =>
      promise.catch((e) => this.internalRelease(e)),
    );
    return promise;
  }

  async abort() {
    this.checkReleased();
    const tx = this.#tx;
    if (tx) {
      await tx.abort();
      this.#tx = null;
    }
  }

  async commit() {
    this.checkReleased();
    const tx = this.#tx;
    this.#tx = null;
    if (tx) {
      await tx.commit();
      this.#tx = null;
    }
  }

  protected async internalRelease(e?: Error): Promise<unknown> {
    const tx = this.#tx;
    this.#tx = null;
    if (tx) {
      await tx.commit();
      this.#tx = null;
    }
    return super.internalRelease(e);
  }
}
