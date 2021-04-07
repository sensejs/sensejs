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
  abstract readonly offset: string;
  protected constructor() {
    super();
  }
}
export class SimpleMessageConsumeContext extends MessageConsumeContext {
  readonly topic: string;
  readonly partition: number;
  readonly offset: string;
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
  }
}

export class BatchedMessageConsumeContext extends MessageConsumeContext {
  readonly topic: string;
  readonly partition: number;
  readonly offset: string;
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

export function InjectSubscribeContext(transform: Transformer = (x) => x): InjectionDecorator {
  return Inject(MessageConsumeContext, {transform});
}

/**
 *
 * @deprecated
 */
export function Message(transform: Transformer = (x) => x): InjectionDecorator {
  return InjectSubscribeContext((x: SimpleMessageConsumeContext) => transform(x.message));
}
