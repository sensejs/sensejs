import {RequestContext, ServiceIdentifier, Transformer, Inject} from '@sensejs/core';
import {Container} from 'inversify';
import * as kafkaNode from 'kafka-node';

export import KafkaMessage = kafkaNode.Message;

export class ConsumingContext extends RequestContext {
  constructor(private readonly container: Container, readonly message: kafkaNode.Message) {
    super();
  }

  bindContextValue<T>(id: ServiceIdentifier<T>, value: T) {
    this.container.bind(id).toConstantValue(value);
  }
}

export function InjectSubscribeContext(transform: Transformer = (x) => x) {
  return Inject(ConsumingContext, {transform});
}

export function Message() {
  return InjectSubscribeContext((x: ConsumingContext) => x.message);
}
