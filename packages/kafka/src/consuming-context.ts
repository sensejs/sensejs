import {ParamBinding, RequestContext, ServiceIdentifier, Transformer} from '@sensejs/core';
import {Container} from 'inversify';
import {Message} from 'kafka-node';

export class ConsumingContext extends RequestContext {
  constructor(private readonly container: Container, readonly message: Message) {
    super();
  }

  bindContextValue<T>(id: ServiceIdentifier<T>, value: T) {
    this.container.bind(id).toConstantValue(value);
  }
}

export function InjectSubscribeContext(transform: Transformer = (x) => x) {
  return ParamBinding(ConsumingContext, {transform});
}

export function Message() {
  return InjectSubscribeContext((x: ConsumingContext) => x.message);
}
