import {Constructor, Transformer} from '@sensejs/utility';
import {Inject, InjectionDecorator, RequestContext, RequestInterceptor, ServiceIdentifier} from '@sensejs/core';
import {Container} from 'inversify';
import {KafkaReceivedMessage} from '@sensejs/kafkajs-standalone';

export class MessageConsumeContext extends RequestContext {
  constructor(
    private readonly container: Container,
    public readonly message: KafkaReceivedMessage,
    public readonly consumerGroup: string,
    public readonly targetConstructor: Constructor,
    public readonly targetMethodKey: keyof any,
  ) {
    super();
  }

  bindContextValue<T>(id: ServiceIdentifier<T>, value: T): void {
    this.container.bind(id).toConstantValue(value);
  }
}

/**
 * @deprecated
 */
export const ConsumerContext = MessageConsumeContext;

export function InjectSubscribeContext(transform: Transformer = (x) => x): InjectionDecorator {
  return Inject(MessageConsumeContext, {transform});
}

export function Message(transform: Transformer = (x) => x): InjectionDecorator {
  return InjectSubscribeContext((x: MessageConsumeContext) => transform(x.message));
}
