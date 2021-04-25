import {
  AbstractConnectionFactory,
  Constructor,
  createModule,
  Inject,
  Logger,
  InjectLogger,
  ModuleClass,
  ModuleOption,
  OnModuleCreate,
  OnModuleDestroy,
  provideConnectionFactory,
  provideOptionInjector,
  ServiceIdentifier,
} from '@sensejs/core';
import {MessageProducer, MessageProducerOption} from '@sensejs/kafkajs-standalone';
import {KafkaLogAdapterOption} from '@sensejs/kafkajs-standalone/src/logging';

export interface LegacyConfigurableMessageProducerOption extends Omit<MessageProducerOption, 'logOption'> {
  logOption?: KafkaLogAdapterOption;
}

export interface MessageProducerModuleOption extends ModuleOption {
  messageProducerOption?: Partial<LegacyConfigurableMessageProducerOption>;
  injectOptionFrom?: ServiceIdentifier<LegacyConfigurableMessageProducerOption>;
}

/**
 * @deprecated
 */
export function createMessageProducerModule(option: MessageProducerModuleOption): Constructor {
  const optionFactory = provideOptionInjector(
    option.messageProducerOption,
    option.injectOptionFrom,
    (fallback, injected): LegacyConfigurableMessageProducerOption => {
      const {connectOption, logOption, ...rest} = Object.assign({}, fallback, injected);
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
  class KafkaProducerModule {
    constructor(
      @InjectLogger()
      private logger: Logger,
      @Inject(connectionFactory.factory)
      private factory: AbstractConnectionFactory<MessageProducer, MessageProducerOption>,
      @Inject(optionFactory.provide)
      private config: LegacyConfigurableMessageProducerOption,
    ) {}

    @OnModuleCreate()
    async onCreate(): Promise<void> {
      await this.factory.connect({...this.config, logger: this.logger});
    }

    @OnModuleDestroy()
    async onDestroy(): Promise<void> {
      await this.factory.disconnect();
    }
  }

  return KafkaProducerModule;
}
