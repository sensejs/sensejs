import {Constructor, Inject, InjectionDecorator, RequestContext, Transformer} from '@sensejs/core';
import {ResolveContext} from '@sensejs/container';
import {KafkaBatchConsumeMessageParam, KafkaReceivedMessage} from '@sensejs/kafkajs-standalone';

export abstract class MessageConsumeContext extends RequestContext {
  abstract resolveContext: ResolveContext;
  abstract readonly targetConstructor: Constructor;
  abstract readonly targetMethodKey: keyof any;
  abstract readonly consumerGroup: string;
  abstract readonly topic: string;
  abstract readonly partition: number;
  /** @deprecated */
  abstract readonly offset: string;
  abstract readonly firstOffset: string | null;
  abstract readonly lastOffset: string;
  protected constructor() {
    super();
  }
}
export class SimpleMessageConsumeContext extends MessageConsumeContext {
  readonly topic: string;
  readonly partition: number;
  readonly offset: string;
  readonly firstOffset: string;
  readonly lastOffset: string;
  constructor(
    readonly resolveContext: ResolveContext,
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
  readonly topic: string;
  readonly partition: number;
  readonly offset: string;
  readonly firstOffset: string | null;
  readonly lastOffset: string;
  constructor(
    readonly resolveContext: ResolveContext,
    readonly targetConstructor: Constructor,
    readonly targetMethodKey: keyof any,
    readonly consumerGroup: string,
    private batchedConsumeParam: KafkaBatchConsumeMessageParam,
  ) {
    super();
    this.topic = this.batchedConsumeParam.batch.topic;
    this.partition = this.batchedConsumeParam.batch.partition;
    this.offset = this.batchedConsumeParam.batch.lastOffset();
    this.firstOffset = this.batchedConsumeParam.batch.firstOffset() ?? null;
    this.lastOffset = this.batchedConsumeParam.batch.lastOffset();
  }

  heartbeat() {
    return this.batchedConsumeParam.heartbeat();
  }

  messageInfo() {
    return this.batchedConsumeParam.batch;
  }

  resolveOffset(offset: string) {
    return this.batchedConsumeParam.resolveOffset(offset);
  }
}
