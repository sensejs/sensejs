import {Component, ComponentFactory, ComponentScope, Module, ModuleConstructor} from '@sensejs/core';
import {MessageProducer, ProducerOption} from './message-producer';
import {inject} from 'inversify';

export interface KafkaPublishModuleOption {
  kafkaProducerOption: ProducerOption;
}

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

  class KafkaPublishModule extends Module({
    factories: [{provide: MessageProducer, factory: KafkaProducerConnectionFactory, scope: ComponentScope.SINGLETON}],
  }) {
    constructor(@inject(KafkaProducerConnectionFactory) private factory: KafkaProducerConnectionFactory) {
      super();
    }

    async onCreate(): Promise<void> {
      super.onCreate();
      await this.factory.connect(option.kafkaProducerOption);
    }

    async onDestroy(): Promise<void> {
      await this.factory.close();
      return super.onDestroy();
    }
  }

  return KafkaPublishModule;
}
