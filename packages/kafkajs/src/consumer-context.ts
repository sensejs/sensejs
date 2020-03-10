import {Transformer} from '@sensejs/utility';
import {Inject, RequestContext, ServiceIdentifier} from '@sensejs/core';
import {Container} from 'inversify';
import {KafkaReceivedMessage} from '@sensejs/kafkajs-standalone';

export class ConsumerContext extends RequestContext {
  constructor(private readonly container: Container, readonly message: KafkaReceivedMessage) {
    super();
  }

  bindContextValue<T>(id: ServiceIdentifier<T>, value: T) {
    this.container.bind(id).toConstantValue(value);
  }
}

export function InjectSubscribeContext(transform: Transformer = (x) => x) {
  return Inject(ConsumerContext, {transform});
}

export function Message() {
  return InjectSubscribeContext((x: ConsumerContext) => x.message);
}
