import {
  AbstractConnectionFactory,
  Constructor,
  createModule,
  Inject,
  ModuleClass,
  ModuleOption,
  OnModuleCreate,
  OnModuleDestroy,
  provideConnectionFactory,
  provideOptionInjector,
  ServiceIdentifier,
} from '@sensejs/core';
import {MessageProducer, MessageProducerOption} from '@sensejs/kafkajs-standalone';

export interface MessageProducerModuleOption extends ModuleOption {
  messageProducerOption?: Partial<MessageProducerOption>;
  injectOptionFrom?: ServiceIdentifier<MessageProducerOption>;
}

export function createMessageProducerModule(option: MessageProducerModuleOption): Constructor {
  const optionFactory = provideOptionInjector(
    option.messageProducerOption,
    option.injectOptionFrom,
    (fallback, injected) => {
      const {connectOption, ...rest} = Object.assign({}, fallback, injected);
      if (typeof connectOption?.brokers === 'undefined') {
        throw new TypeError('brokers not provided');
      }
      return {connectOption, ...rest};
    },
  );

  const connectionFactory = provideConnectionFactory(
    async (option: MessageProducerOption) => {
      const messageProducer = new MessageProducer(option);
      await messageProducer.connect();
      return messageProducer;
    },
    async (producer) => {
      await producer.disconnect();
    },
    MessageProducer,
  );

  @ModuleClass({
    requires: [createModule(option)],
    factories: [optionFactory, connectionFactory],
  })
  class KafkaPublishModule {
    constructor(
      @Inject(connectionFactory.factory)
      private factory: AbstractConnectionFactory<MessageProducer, MessageProducerOption>,
    ) {
    }

    @OnModuleCreate()
    async onCreate(@Inject(optionFactory.provide) config: MessageProducerOption): Promise<void> {
      await this.factory.connect(config);
    }

    @OnModuleDestroy()
    async onDestroy(): Promise<void> {
      await this.factory.disconnect();
    }
  }

  return KafkaPublishModule;
}
