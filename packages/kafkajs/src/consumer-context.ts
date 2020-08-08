import {Transformer} from '@sensejs/utility';
import {Inject, InjectionDecorator, RequestContext, ServiceIdentifier} from '@sensejs/core';
import {Container} from 'inversify';
import {KafkaReceivedMessage} from '@sensejs/kafkajs-standalone';

export class ConsumerContext extends RequestContext {
  constructor(private readonly container: Container, readonly message: KafkaReceivedMessage) {
    super();
  }

  bindContextValue<T>(id: ServiceIdentifier<T>, value: T): void {
    this.container.bind(id).toConstantValue(value);
  }
}

export function InjectSubscribeContext(transform: Transformer = (x) => x): InjectionDecorator {
  return Inject(ConsumerContext, {transform});
}

export function Message(transform: Transformer = (x) => x): InjectionDecorator {
  return InjectSubscribeContext((x: ConsumerContext) => transform(x.message));
}
