import {
  composeRequestInterceptor,
  createModule,
  Inject,
  invokeMethod,
  ModuleClass,
  ModuleOption,
  ModuleScanner,
  OnModuleCreate,
  OnModuleDestroy,
  provideConnectionFactory,
  provideOptionInjector,
  RequestInterceptor,
  ServiceIdentifier,
} from '@sensejs/core';
import {Constructor} from '@sensejs/utility';
import {Container} from 'inversify';
import {KafkaReceivedMessage, MessageConsumer, MessageConsumerOption} from '@sensejs/kafkajs-standalone';
import {ConsumerContext} from './consumer-context';
import lodash from 'lodash';
import {
  getSubscribeControllerMetadata,
  getSubscribeTopicMetadata,
  SubscribeControllerMetadata,
  SubscribeTopicMetadata,
  SubscribeTopicOption,
} from './consumer-decorators';

export interface MessageConsumerModuleOption extends ModuleOption {
  globalInterceptors?: Constructor<RequestInterceptor>[];
  messageConsumerOption?: Partial<MessageConsumerOption>;
  injectOptionFrom?: ServiceIdentifier;
  matchLabels?: (string | symbol)[] | Set<string | symbol>;
}

function mergeConnectOption(
  fallback?: Partial<MessageConsumerOption>,
  injected?: Partial<MessageConsumerOption>,
): MessageConsumerOption {
  const {connectOption, fetchOption, ...rest} = Object.assign({}, fallback, injected);
  if (typeof connectOption?.brokers === 'undefined') {
    throw new TypeError('connectOption.brokers not provided');
  }

  if (typeof fetchOption?.groupId === 'undefined') {
    throw new TypeError('fetchOption.groupId not provided');
  }
  return {connectOption, fetchOption, ...rest};
}

function scanSubscriber(
  option: MessageConsumerModuleOption,
  connectionModule: Constructor,
  messageConsumerSymbol: symbol,
) {
  @ModuleClass({
    requires: [connectionModule],
  })
  class SubscriberScanModule {
    constructor(
      @Inject(Container) private container: Container,
      @Inject(messageConsumerSymbol) private messageConsumer: MessageConsumer,
    ) {}

    @OnModuleCreate()
    async onCreate(@Inject(ModuleScanner) moduleScanner: ModuleScanner) {
      moduleScanner.scanModule((moduleMetadata) => {
        moduleMetadata.components.forEach((component) => {
          const controllerMetadata = getSubscribeControllerMetadata(component);
          if (!controllerMetadata) {
            return;
          }
          const matchLabels = new Set(option.matchLabels);
          const intersectedLabels = lodash.intersection([...matchLabels], [...controllerMetadata.labels]);
          if (intersectedLabels.length === matchLabels.size) {
            this.scanPrototypeMethod(component, controllerMetadata);
          }
        });
      });

      return this.messageConsumer.start();
    }

    @OnModuleDestroy()
    async onDestroy() {
      return this.messageConsumer.stop();
    }

    private scanPrototypeMethod(component: Constructor, controllerMetadata: SubscribeControllerMetadata) {
      for (const propertyDescriptor of Object.values(Object.getOwnPropertyDescriptors(component.prototype))) {
        const subscribeMetadata = getSubscribeTopicMetadata(propertyDescriptor.value);
        const method = propertyDescriptor.value;

        if (!subscribeMetadata || method === undefined) {
          continue;
        }

        const {fallbackOption = {}, injectOptionFrom} = subscribeMetadata;
        const injected = injectOptionFrom ? this.container.get<SubscribeTopicOption>(injectOptionFrom) : {};

        const subscribeOption = Object.assign({}, fallbackOption, injected);
        if (typeof subscribeOption.topic !== 'string') {
          throw new TypeError('subscribe topic must be a string');
        }

        const consumeCallback = this.getConsumeCallback(controllerMetadata, subscribeMetadata, method);
        this.messageConsumer.subscribe(subscribeOption.topic, consumeCallback, subscribeOption.fromBeginning);
      }
    }

    private getConsumeCallback<T>(
      controllerMetadata: SubscribeControllerMetadata<T>,
      subscribeMetadata: SubscribeTopicMetadata,
      method: keyof T,
    ) {
      return async (message: KafkaReceivedMessage) => {
        const childContainer = this.container.createChild();
        childContainer.bind(Container).toConstantValue(childContainer);
        const composedInterceptor = composeRequestInterceptor(childContainer, [
          ...(option.globalInterceptors ?? []),
          ...controllerMetadata.interceptors,
          ...subscribeMetadata.interceptors,
        ]);
        const context = new ConsumerContext(childContainer, message);
        childContainer.bind(ConsumerContext).toConstantValue(context);
        const interceptor = childContainer.get(composedInterceptor);
        await interceptor.intercept(context, async () => {
          await invokeMethod(childContainer, controllerMetadata.target, method);
        });
      };
    }
  }

  return SubscriberScanModule;
}

function KafkaConsumerHelperModule(option: MessageConsumerModuleOption, exportSymbol: symbol) {
  const optionProvider = provideOptionInjector(
    option.messageConsumerOption,
    option.injectOptionFrom,
    mergeConnectOption,
  );

  const factoryProvider = provideConnectionFactory<MessageConsumer, MessageConsumerOption>(
    async (option) => {
      return new MessageConsumer(option);
    }, // connect on kafkaConsumerModule
    async () => undefined, // close on KafkaConsumerModule
    exportSymbol,
  );

  @ModuleClass({
    requires: [createModule(option)],
    factories: [optionProvider, factoryProvider],
  })
  class KafkaConsumerGroupModule {
    constructor(
      @Inject(factoryProvider.factory) private consumerGroupFactory: InstanceType<typeof factoryProvider.factory>,
      @Inject(optionProvider.provide) private config: MessageConsumerOption,
    ) {}

    @OnModuleCreate()
    async onCreate(): Promise<void> {
      await this.consumerGroupFactory.connect(this.config);
    }

    @OnModuleDestroy()
    async onDestroy(): Promise<void> {
      await this.consumerGroupFactory.disconnect();
    }
  }

  return createModule({requires: [KafkaConsumerGroupModule]});
}

/**
 * Create kafka consumer module for sense.js framework
 * @param option
 */
export function createMessageConsumerModule(option: MessageConsumerModuleOption): Constructor {
  const injectMessageConsumerSymbol = Symbol('MessageConsumer');
  const kafkaConnectionModule = KafkaConsumerHelperModule(option, injectMessageConsumerSymbol);
  return scanSubscriber(option, kafkaConnectionModule, injectMessageConsumerSymbol);
}
