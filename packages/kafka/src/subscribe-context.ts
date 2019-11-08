import {ParamBinding, RequestContext, ServiceIdentifier, Transformer} from '@sensejs/core';
import {Container} from 'inversify';
import {Message} from 'kafka-node';

export class SubscribeContext extends RequestContext {
  constructor(private readonly container: Container, readonly message: Message) {
    super();
  }

  bindContextValue<T>(id: ServiceIdentifier<T>, value: T) {
    this.container.bind(id).toConstantValue(value);
  }
}

export function InjectSubscribeContext(transform: Transformer = (x) => x) {
  return ParamBinding(SubscribeContext, {transform});
}

export function Message() {
  return InjectSubscribeContext((x: SubscribeContext) => x.message);
}
