import {
  Component,
  ComponentFactory,
  ComponentScope,
  Module,
  ModuleConstructor,
  ModuleOption,
  ServiceIdentifier,
} from '@sensejs/core';
import {MessageProducer, ProducerOption} from './message-producer';
import {inject} from 'inversify';

export interface StaticKafkaPublishModuleOption extends ModuleOption {
  type: 'static';
  kafkaProducerOption: ProducerOption;
}

export interface InjectedKafkaPublishModuleOption extends ModuleOption {
  type: 'injected';
  injectedSymbol: ServiceIdentifier<StaticKafkaPublishModuleOption>;
}

export type KafkaPublishModuleOption = StaticKafkaPublishModuleOption | InjectedKafkaPublishModuleOption;

export function KafkaPublishModule(option: KafkaPublishModuleOption): ModuleConstructor {
  @Component()
  class KafkaProducerConnectionFactory extends ComponentFactory<MessageProducer> {
    private messageProducer?: MessageProducer;

    build(): MessageProducer {
      if (this.messageProducer) {
        return this.messageProducer;
      }
      throw new Error('messageProducer not connected yet');
    }

    async connect(option: ProducerOption): Promise<MessageProducer> {
      const messageProducer = new MessageProducer(option);
      await messageProducer.initialize();
      this.messageProducer = messageProducer;
      return this.messageProducer;
    }

    async close() {
      if (this.messageProducer) {
        const messageProducer = this.messageProducer;
        delete this.messageProducer;
        await messageProducer.close();
      }
    }
  }

  const injectSymbol = option.type === 'static' ? Symbol() : option.injectedSymbol;
  const configConstants = option.type === 'static' ? [{provide: injectSymbol, value: option.kafkaProducerOption}] : [];
  const constants = (option.constants ?? []).concat(configConstants);
  const factories = (option.factories ?? []).concat([
    {provide: MessageProducer, factory: KafkaProducerConnectionFactory, scope: ComponentScope.SINGLETON},
  ]);
  option = Object.assign({}, option, {factories, constants});

  class KafkaPublishModule extends Module(option) {
    constructor(
      @inject(KafkaProducerConnectionFactory) private factory: KafkaProducerConnectionFactory,
      @inject(injectSymbol) private config: ProducerOption,
    ) {
      super();
    }

    async onCreate(): Promise<void> {
      super.onCreate();
      await this.factory.connect(this.config);
    }

    async onDestroy(): Promise<void> {
      await this.factory.close();
      return super.onDestroy();
    }
  }

  return KafkaPublishModule;
}
