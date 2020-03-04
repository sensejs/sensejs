import {
  Class,
  composeRequestInterceptor,
  Constructor,
  createModule,
  Inject,
  invokeMethod,
  ModuleClass,
  ModuleOption,
  OnModuleCreate,
  OnModuleDestroy,
  provideConnectionFactory,
  provideOptionInjector,
  RequestInterceptor,
  ServiceIdentifier,
} from '@sensejs/core';
import {Container} from 'inversify';
import {MessageConsumer, MessageConsumerOption, KafkaReceivedMessage} from '@sensejs/kafkajs-standalone';
import {ConsumerContext} from './consumer-context';
import {
  getSubscribeControllerMetadata,
  getSubscribeTopicMetadata,
  SubscribeControllerMetadata,
  SubscribeTopicMetadata,
} from './consumer-decorators';

export interface KafkaConsumerModuleOption extends ModuleOption {
  globalInterceptors?: Class<RequestInterceptor>[];
  messageConsumerOption?: Partial<MessageConsumerOption>;
  injectOptionFrom?: ServiceIdentifier;
}

export interface KafkaTopicSubscriptionOption {
  topic: string;
  fromBeginning?: boolean;
}

function mergeConnectOption(
  fallback?: Partial<MessageConsumerOption>,
  injected?: Partial<MessageConsumerOption>,
): MessageConsumerOption {
  const {connectOption, fetchOption, ...rest} = Object.assign({}, fallback, injected);
  if (typeof connectOption?.brokers === 'undefined') {
    throw new TypeError('kafkaHost not provided');
  }

  if (typeof fetchOption?.groupId === 'undefined') {
    throw new TypeError('groupId not provided');
  }
  return {connectOption, fetchOption, ...rest};
}

function createSubscriberTopicModule(
  consumerGroupModule: Constructor,
  option: KafkaConsumerModuleOption,
  controllerMetadata: SubscribeControllerMetadata,
  subscribeMetadata: SubscribeTopicMetadata,
  method: Function,
  injectSymbol: symbol,
) {
  const {fallbackOption, injectOptionFrom} = subscribeMetadata;
  const optionProvider = provideOptionInjector(fallbackOption, injectOptionFrom, (defaultValue, injectedValue) => {
    return Object.assign({}, defaultValue, injectedValue);
  });

  @ModuleClass({
    requires: [consumerGroupModule],
    factories: [optionProvider],
  })
  class TopicModule {
    constructor(
      @Inject(optionProvider.provide) config: KafkaTopicSubscriptionOption,
      @Inject(injectSymbol) messageConsumer: MessageConsumer,
      @Inject(Container) container: Container,
    ) {

      const consumeCallback = async (message: KafkaReceivedMessage) => {
        const childContainer = container.createChild();
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
          const target = childContainer.get<object>(controllerMetadata.target);
          await invokeMethod(childContainer, target, method);
        });
      };
      messageConsumer.subscribe(config.topic, consumeCallback, config.fromBeginning);
    }
  }

  return TopicModule;
}

function scanController(option: KafkaConsumerModuleOption, module: Constructor, injectSymbol: symbol) {
  const result: Constructor[] = [];
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
      const subscribeTopicModule = createSubscriberTopicModule(
        module,
        option,
        controllerMetadata,
        subscribeMetadata,
        propertyDescriptor.value,
        injectSymbol,
      );
      result.push(subscribeTopicModule);
    }
  }
  return result;
}

function KafkaConsumerHelperModule(option: KafkaConsumerModuleOption, exportSymbol: symbol) {
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

export function createKafkaConsumerModule(option: KafkaConsumerModuleOption): Constructor {
  const injectMessageConsumerSymbol = Symbol('MessageConsumer');
  const kafkaConnectionModule = KafkaConsumerHelperModule(option, injectMessageConsumerSymbol);
  const subscribeTopicModules = scanController(option, kafkaConnectionModule, injectMessageConsumerSymbol);

  @ModuleClass({
    requires: subscribeTopicModules,
  })
  class KafkaConsumerModule {
    constructor(@Inject(injectMessageConsumerSymbol) private messageConsumer: MessageConsumer) {
    }

    @OnModuleCreate()
    async onCreate(): Promise<void> {
      await this.messageConsumer.start();
    }

    @OnModuleDestroy()
    async onDestroy(): Promise<void> {
      await this.messageConsumer.stop();
    }
  }

  return KafkaConsumerModule;
}
