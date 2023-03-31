import {Constructor} from '@sensejs/core';
import {KafkaBatchConsumeMessageParam, KafkaReceivedMessage} from '@sensejs/kafkajs-standalone';

export abstract class MessageConsumeContext {
  abstract readonly targetConstructor: Constructor;
  abstract readonly targetMethodKey: keyof any;
  abstract readonly consumerGroup: string;
  abstract readonly topic: string;
  abstract readonly partition: number;
  abstract readonly firstOffset: string | null;
  abstract readonly lastOffset: string;
}
export class SimpleMessageConsumeContext extends MessageConsumeContext {
  readonly topic: string;
  readonly partition: number;
  readonly offset: string;
  readonly firstOffset: string;
  readonly lastOffset: string;
  constructor(
    readonly targetConstructor: Constructor,
    readonly targetMethodKey: keyof any,
    readonly consumerGroup: string,
    readonly message: KafkaReceivedMessage,
  ) {
    super();
    this.topic = message.topic;
    this.partition = message.partition;
    this.offset = message.offset;
    this.firstOffset = message.offset;
    this.lastOffset = message.offset;
  }
}

export class BatchedMessageConsumeContext extends MessageConsumeContext {
  #batchedConsumeParam;

  get topic() {
    return this.#batchedConsumeParam.batch.topic;
  }

  get partition() {
    return this.#batchedConsumeParam.batch.partition;
  }

  get offset() {
    return this.#batchedConsumeParam.batch.lastOffset();
  }

  get firstOffset() {
    return this.#batchedConsumeParam.batch.firstOffset() ?? null;
  }

  get lastOffset() {
    return this.#batchedConsumeParam.batch.lastOffset();
  }

  constructor(
    readonly targetConstructor: Constructor,
    readonly targetMethodKey: keyof any,
    readonly consumerGroup: string,
    batchedConsumeParam: KafkaBatchConsumeMessageParam,
  ) {
    super();
    this.#batchedConsumeParam = batchedConsumeParam;
  }

  heartbeat() {
    return this.#batchedConsumeParam.heartbeat();
  }

  messageInfo() {
    return this.#batchedConsumeParam.batch;
  }

  resolveOffset(offset: string) {
    return this.#batchedConsumeParam.resolveOffset(offset);
  }
}
