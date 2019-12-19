import {
  AbstractConnectionFactory,
  ComponentScope,
  createConfigHelperFactory,
  createConnectionFactory,
  Inject,
  Module,
  ModuleConstructor,
  ModuleOption,
  ServiceIdentifier,
} from '@sensejs/core';
import {MessageProducer, ProducerOption} from './message-producer';
import merge from 'lodash.merge';

export interface KafkaPublishModuleOption extends ModuleOption {
  kafkaProducerOption?: Partial<ProducerOption>;
  injectOptionFrom?: ServiceIdentifier<Partial<ProducerOption>>;
}

export function KafkaProducerModule(option: KafkaPublishModuleOption): ModuleConstructor {
  const ConfigFactory = createConfigHelperFactory<ProducerOption>(
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

  const configSymbol = Symbol();

  const ConnectionFactory = createConnectionFactory<MessageProducer, ProducerOption>(
    async (option) => {
      const messageProducer = new MessageProducer(option);
      await messageProducer.initialize();
      return messageProducer;
    },
    async (producer) => {
      await producer.close();
    },
  );

  class KafkaPublishModule extends Module({
    requires: [Module(option)],
    factories: [
      {provide: configSymbol, factory: ConfigFactory, scope: ComponentScope.SINGLETON},
      {provide: MessageProducer, factory: ConnectionFactory, scope: ComponentScope.SINGLETON},
    ],
  }) {
    constructor(
      @Inject(ConnectionFactory) private factory: AbstractConnectionFactory<MessageProducer, ProducerOption>,
      @Inject(configSymbol) private config: ProducerOption,
    ) {
      super();
    }

    async onCreate(): Promise<void> {
      await super.onCreate();
      await this.factory.connect(this.config);
    }

    async onDestroy(): Promise<void> {
      await this.factory.disconnect();
      return super.onDestroy();
    }
  }

  return Module({requires: [KafkaPublishModule]});
}
