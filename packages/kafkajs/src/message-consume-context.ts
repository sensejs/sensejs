import {Constructor, Transformer} from '@sensejs/utility';
import {Inject, InjectionDecorator, RequestContext} from '@sensejs/core';
import {KafkaReceivedMessage} from '@sensejs/kafkajs-standalone';
import {ResolveContext} from '@sensejs/container';

export class MessageConsumeContext extends RequestContext {
  constructor(
    protected readonly resolveContext: ResolveContext,
    public readonly message: KafkaReceivedMessage,
    public readonly consumerGroup: string,
    public readonly targetConstructor: Constructor,
    public readonly targetMethodKey: keyof any,
  ) {
    super();
  }
}

export function InjectSubscribeContext(transform: Transformer = (x) => x): InjectionDecorator {
  return Inject(MessageConsumeContext, {transform});
}

export function Message(transform: Transformer = (x) => x): InjectionDecorator {
  return InjectSubscribeContext((x: MessageConsumeContext) => transform(x.message));
}
