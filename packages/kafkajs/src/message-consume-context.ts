import {Constructor} from '@sensejs/core';
import {KafkaBatchConsumeMessageParam, KafkaReceivedMessage} from '@sensejs/kafkajs-standalone';
import type {Batch} from 'kafkajs';

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
  #message: KafkaReceivedMessage;
  get topic() {
    return this.#message.topic;
  }

  get partition() {
    return this.#message.partition;
  }

  get offset() {
    return this.#message.offset;
  }

  get firstOffset() {
    return this.#message.offset;
  }

  get lastOffset() {
    return this.#message.offset;
  }

  constructor(
    readonly targetConstructor: Constructor,
    readonly targetMethodKey: keyof any,
    readonly consumerGroup: string,
    message: KafkaReceivedMessage,
  ) {
    super();
    this.#message = message;
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

  messageInfo(): Batch {
    return this.#batchedConsumeParam.batch;
  }

  resolveOffset(offset: string) {
    return this.#batchedConsumeParam.resolveOffset(offset);
  }
}
