import {
  AbstractConnectionFactory,
  Constructor,
  createModule,
  Inject,
  InjectLogger,
  ModuleClass,
  ModuleOption,
  OnModuleCreate,
  OnModuleDestroy,
  provideConnectionFactory,
  provideOptionInjector,
  ServiceIdentifier,
} from '@sensejs/core';
import {
  MessageProducerOption,
  MessageProducerProvider,
  PooledKafkaJsProducerProvider,
  PooledMessageProducerOption,
  SimpleKafkaJsProducerProvider,
} from '@sensejs/kafkajs-standalone';
import _ from 'lodash';
import {Logger} from '@sensejs/utility';

export type ConfigurableMessageProducerOption = Exclude<MessageProducerOption, 'logger'>;
export type ConfigurablePooledMessageProducerOption = Exclude<PooledMessageProducerOption, 'logger'>;

export interface SimpleProducerModuleOption extends ModuleOption {
  kafkaProducerOption?: Partial<ConfigurableMessageProducerOption>;
  injectOptionFrom?: ServiceIdentifier<Partial<ConfigurableMessageProducerOption>>;
}

export interface PooledProducerModuleOption extends ModuleOption {
  kafkaProducerOption?: Partial<ConfigurablePooledMessageProducerOption>;
  injectOptionFrom?: ServiceIdentifier<Partial<ConfigurablePooledMessageProducerOption>>;
}

export function createPooledProducerModule(option: PooledProducerModuleOption): Constructor {
  const connectionFactory = provideConnectionFactory<PooledKafkaJsProducerProvider, MessageProducerOption>(
    async (option) => new PooledKafkaJsProducerProvider(option),
    (provider) => provider.destroy(),
    MessageProducerProvider as ServiceIdentifier<any>,
  );

  const configurationFactory = provideOptionInjector(
    option.kafkaProducerOption,
    option.injectOptionFrom,
    (fallback, injected) => _.merge({}, fallback, injected),
  );

  @ModuleClass({
    requires: [createModule(option)],
    factories: [connectionFactory, configurationFactory],
  })
  class PooledProducerModule {
    constructor(@InjectLogger() private logger: Logger) {}

    @OnModuleCreate()
    async onModuleCreate(
      @Inject(connectionFactory.factory)
      factory: AbstractConnectionFactory<MessageProducerProvider, MessageProducerOption>,
      @Inject(configurationFactory.provide)
      option: MessageProducerOption,
    ) {
      await factory.connect({...option, logger: this.logger});
    }

    @OnModuleDestroy()
    async onModuleDestroy(
      @Inject(connectionFactory.factory)
      factory: AbstractConnectionFactory<MessageProducerProvider, MessageProducerOption>,
    ) {
      await factory.disconnect();
    }
  }
  return PooledProducerModule;
}

export function createSimpleProducerModule(option: SimpleProducerModuleOption): Constructor {
  const connectionFactory = provideConnectionFactory<SimpleKafkaJsProducerProvider, MessageProducerOption>(
    async (option) => new SimpleKafkaJsProducerProvider(option),
    (provider) => provider.destroy(),
    MessageProducerProvider as ServiceIdentifier<any>,
  );

  const configurationFactory = provideOptionInjector(
    option.kafkaProducerOption,
    option.injectOptionFrom,
    (fallback, injected) => _.merge({}, fallback, injected),
  );

  @ModuleClass({
    requires: [createModule(option)],
    factories: [connectionFactory, configurationFactory],
  })
  class SimpleProducerModule {
    constructor(@InjectLogger() private logger: Logger) {}

    @OnModuleCreate()
    async onModuleCreate(
      @Inject(connectionFactory.factory)
      factory: AbstractConnectionFactory<MessageProducerProvider, MessageProducerOption>,
      @Inject(configurationFactory.provide)
      option: MessageProducerOption,
    ) {
      await factory.connect({...option, logger: this.logger});
    }

    @OnModuleDestroy()
    async onModuleDestroy(
      @Inject(connectionFactory.factory)
      factory: AbstractConnectionFactory<MessageProducerProvider, MessageProducerOption>,
    ) {
      await factory.disconnect();
    }
  }
  return SimpleProducerModule;
}
