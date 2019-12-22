import {
  AbstractConnectionFactory,
  createLegacyModule,
  createModule,
  Inject,
  ModuleClass,
  ModuleOption,
  OnModuleCreate,
  OnModuleDestroy,
  provideConnectionFactory,
  provideOptionInjector,
  ServiceIdentifier,
  Constructor,
} from '@sensejs/core';
import {MessageProducer, ProducerOption} from './message-producer';
import merge from 'lodash.merge';

export interface KafkaPublishModuleOption extends ModuleOption {
  kafkaProducerOption?: Partial<ProducerOption>;
  injectOptionFrom?: ServiceIdentifier<Partial<ProducerOption>>;
}

export function createKafkaProducerModule(option: KafkaPublishModuleOption): Constructor {
  const optionFactory = provideOptionInjector(
    option.kafkaProducerOption,
    option.injectOptionFrom,
    (fallback, injected) => {
      const {kafkaHost, ...rest} = merge({}, fallback, injected);
      if (typeof kafkaHost === 'undefined') {
        throw new TypeError('kafkaHost not provided');
      }
      return {kafkaHost, ...rest};
    },
  );

  const connectionFactory = provideConnectionFactory(
    async (option: ProducerOption) => {
      const messageProducer = new MessageProducer(option);
      await messageProducer.initialize();
      return messageProducer;
    },
    async (producer) => {
      await producer.close();
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
      private factory: AbstractConnectionFactory<MessageProducer, ProducerOption>,
    ) {
    }

    @OnModuleCreate()
    async onCreate(@Inject(optionFactory.provide) config: ProducerOption): Promise<void> {
      await this.factory.connect(config);
    }

    @OnModuleDestroy()
    async onDestroy(): Promise<void> {
      await this.factory.disconnect();
    }
  }

  return KafkaPublishModule;
}

export const KafkaProducerModule = createLegacyModule(
  createKafkaProducerModule,
  'Base class style module KafkaProducerModule is deprecated, use KafkaProducerModuleClass decorator instead',
);
