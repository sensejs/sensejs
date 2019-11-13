import {
  Abstract,
  composeRequestInterceptor,
  createConfigHelperFactory,
  invokeMethod,
  Module,
  ModuleConstructor,
  ModuleOption,
  RequestInterceptor,
  ServiceIdentifier,
} from '@sensejs/core';
import {Container, inject} from 'inversify';
import {Message} from 'kafka-node';
import {MessageConsumer} from './message-consumer';
import {ConsumingContext} from './consuming-context';
import {getSubscribeControllerMetadata, getSubscribeTopicMetadata} from './consuming-decorators';
import {ConnectOption, ConsumeOption, FetchOption, TopicConsumerOption} from './message-consume-manager';
import merge from 'lodash.merge';

export interface KafkaConsumerOption {
  kafkaConnectOption: ConnectOption;
  defaultFetchOption?: FetchOption;
  defaultConsumeOption?: ConsumeOption;
}

export interface KafkaConsumerModuleOption extends ModuleOption {
  globalInterceptors?: Abstract<RequestInterceptor>[];
  defaultKafkaConsumerOption?: {
    kafkaConnectOption?: Partial<ConnectOption>;
    defaultFetchOption?: Partial<FetchOption>;
    defaultConsumeOption?: Partial<ConsumeOption>;
  };
  injectOptionFrom?: ServiceIdentifier<unknown>;
}

export function KafkaConsumerModule(option: KafkaConsumerModuleOption): ModuleConstructor {
  const ConfigFactory = createConfigHelperFactory(
    option.defaultKafkaConsumerOption,
    option.injectOptionFrom,
    (fallback, injected) => {
      const {kafkaConnectOption, ...rest} = merge({}, fallback, injected);
      const {kafkaHost, groupId} = kafkaConnectOption ?? {};
      if (typeof kafkaHost === 'undefined') {
        throw new TypeError('kafkaHost not provided');
      }

      if (typeof groupId === 'undefined') {
        throw new TypeError('groupId not provided');
      }
      return {kafkaConnectOption: {kafkaHost, groupId}, ...rest};
    },
  );
  const configSymbol = Symbol();

  class KafkaConsumerModule extends Module({
    requires: [Module(option)],
    factories: [{provide: configSymbol, factory: ConfigFactory}],
  }) {
    private consumerGroup?: MessageConsumer;

    constructor(
      @inject(Container) private container: Container,
      @inject(configSymbol) private config: KafkaConsumerOption,
    ) {
      super();
    }

    async onCreate(): Promise<void> {
      await super.onCreate();
      const map = this.scanController();

      if (map.size < 0) {
        return;
      }

      this.consumerGroup = new MessageConsumer(this.config.kafkaConnectOption);

      for (const option of map.values()) {
        this.consumerGroup.subscribe(option.topic, option.consumeCallback, option.consumeOption, option.fetchOption);
      }

      await this.consumerGroup.open();
    }

    async onDestroy(): Promise<void> {
      if (this.consumerGroup) {
        const consumerGroup = this.consumerGroup;
        delete this.consumerGroup;
        await consumerGroup.close();
      }
      return super.onDestroy();
    }

    private scanController() {
      const map = new Map<string, TopicConsumerOption>();
      for (const component of option.components || []) {
        const controllerMetadata = getSubscribeControllerMetadata(component);
        if (!controllerMetadata) {
          continue;
        }
        for (const propertyDescriptor of Object.values(Object.getOwnPropertyDescriptors(component.prototype))) {
          const subscribeMetadata = getSubscribeTopicMetadata(propertyDescriptor.value);

          if (!subscribeMetadata) {
            continue;
          }
          const topic = subscribeMetadata.topic;

          if (map.get(topic)) {
            throw new Error('Duplicated topic subscription');
          }

          const composedInterceptor = composeRequestInterceptor(this.container, [
            ...(option.globalInterceptors || []),
            ...controllerMetadata.interceptors,
            ...subscribeMetadata.interceptors,
          ]);

          map.set(topic, {
            connectOption: this.config.kafkaConnectOption,
            fetchOption: this.config.defaultFetchOption,
            consumeOption: this.config.defaultConsumeOption,
            topic,
            consumeCallback: async (message: Message) => {
              const container = this.container.createChild();
              const context = new ConsumingContext(container, message);
              container.bind(ConsumingContext).toConstantValue(context);
              const interceptor = container.get(composedInterceptor);
              await interceptor.intercept(context, async () => {
                const target = container.get<object>(controllerMetadata.target);
                await invokeMethod(container, target, propertyDescriptor.value);
              });
            },
          });
        }
      }
      return map;
    }
  }

  return KafkaConsumerModule;
}
