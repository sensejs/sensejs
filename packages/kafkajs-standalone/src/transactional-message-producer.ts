import {KafkaSendOption, TransactionalMessageProducer} from './types';
import {Offsets, Producer, Transaction} from 'kafkajs';
import {BaseKafkaJsMessageProducer} from './base-message-producer';

export class KafkaJsTransactionalMessageProducer extends BaseKafkaJsMessageProducer
  implements TransactionalMessageProducer {
  private tx?: Transaction = undefined;
  constructor(option: KafkaSendOption, private producer: Producer, onRelease: (e?: Error) => Promise<void>) {
    super(option, onRelease);
  }

  protected async sender() {
    if (this.tx) {
      return this.tx;
    }
    this.tx = await this.producer.transaction();
    return this.tx;
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
    const tx = this.tx;
    if (tx) {
      await tx.abort();
      this.tx = undefined;
    }
  }

  async commit() {
    this.checkReleased();
    const tx = this.tx;
    this.tx = undefined;
    if (tx) {
      await tx.commit();
      this.tx = undefined;
    }
  }

  protected async internalRelease(e?: Error): Promise<unknown> {
    const tx = this.tx;
    this.tx = undefined;
    if (tx) {
      await tx.commit();
      this.tx = undefined;
    }
    return super.internalRelease(e);
  }
}
