import {
  Class,
  composeRequestInterceptor,
  Inject,
  invokeMethod,
  Module,
  ModuleConstructor,
  ModuleOption,
  provideConnectionFactory,
  provideOptionInjector,
  RequestInterceptor,
  ServiceIdentifier,
} from '@sensejs/core';
import {Container} from 'inversify';
import {Message} from 'kafka-node';
import {ConsumeTopicOption, MessageConsumer} from './message-consumer';
import {ConsumingContext} from './consuming-context';
import {
  getSubscribeControllerMetadata,
  getSubscribeTopicMetadata,
  SubscribeControllerMetadata,
  SubscribeTopicMetadata,
} from './consuming-decorators';
import {ConnectOption, ConsumeOption, FetchOption} from './message-consume-manager';

export interface KafkaConsumerOption extends ConnectOption, FetchOption, ConsumeOption {}

export interface KafkaConsumerModuleOption extends ModuleOption {
  globalInterceptors?: Class<RequestInterceptor>[];
  defaultKafkaConsumerOption?: Partial<KafkaConsumerOption>;
  injectOptionFrom?: ServiceIdentifier;
}

function mergeConnectOption(
  fallback?: Partial<KafkaConsumerOption>,
  injected?: Partial<KafkaConsumerOption>,
): KafkaConsumerOption {
  const {kafkaHost, groupId, ...rest} = Object.assign({}, fallback, injected);
  if (typeof kafkaHost === 'undefined') {
    throw new TypeError('kafkaHost not provided');
  }

  if (typeof groupId === 'undefined') {
    throw new TypeError('groupId not provided');
  }
  return {kafkaHost, groupId, ...rest};
}

function createSubscriberTopicModule(
  consumerGroupModule: ModuleConstructor,
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

  class TopicModule extends Module({
    requires: [consumerGroupModule],
    factories: [optionProvider],
  }) {
    constructor(
      @Inject(optionProvider.provide) config: ConsumeTopicOption,
      @Inject(injectSymbol) messageConsumer: MessageConsumer,
      @Inject(Container) container: Container,
    ) {
      super();

      const composedInterceptor = composeRequestInterceptor(container, [
        ...(option.globalInterceptors ?? []),
        ...controllerMetadata.interceptors,
        ...subscribeMetadata.interceptors,
      ]);

      const consumeCallback = async (message: Message) => {
        const childContainer = container.createChild();
        const context = new ConsumingContext(childContainer, message);
        childContainer.bind(ConsumingContext).toConstantValue(context);
        const interceptor = childContainer.get(composedInterceptor);
        await interceptor.intercept(context, async () => {
          const target = childContainer.get<object>(controllerMetadata.target);
          await invokeMethod(childContainer, target, method);
        });
      };
      messageConsumer.subscribe(Object.assign({}, config, {consumeCallback}));
    }
  }

  return TopicModule;
}

function scanController(option: KafkaConsumerModuleOption, module: ModuleConstructor, injectSymbol: symbol) {
  const result: ModuleConstructor[] = [];
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

function KafkaConsumerHelperModule(option: KafkaConsumerModuleOption, exportSymbol: symbol): ModuleConstructor {
  const optionProvider = provideOptionInjector(
    option.defaultKafkaConsumerOption,
    option.injectOptionFrom,
    mergeConnectOption,
  );

  const factoryProvider = provideConnectionFactory<MessageConsumer, ConnectOption>(
    async (option) => {
      return new MessageConsumer(option);
    }, // connect on kafkaConsumerModule
    async () => undefined, // close on KafkaConsumerModule
    exportSymbol,
  );

  class KafkaConsumerGroupModule extends Module({
    requires: [Module(option)],
    factories: [optionProvider, factoryProvider],
  }) {
    constructor(
      @Inject(factoryProvider.factory) private consumerGroupFactory: InstanceType<typeof factoryProvider.factory>,
      @Inject(optionProvider.provide) private config: KafkaConsumerOption,
    ) {
      super();
    }

    async onCreate(): Promise<void> {
      await super.onCreate();
      await this.consumerGroupFactory.connect(this.config);
    }

    async onDestroy(): Promise<void> {
      await this.consumerGroupFactory.disconnect();
      return super.onDestroy();
    }
  }

  return Module({requires: [KafkaConsumerGroupModule]});
}

export function KafkaConsumerModule(option: KafkaConsumerModuleOption): ModuleConstructor {
  const injectMessageConsumerSymbol = Symbol('MessageConsumer');
  const kafkaConnectionModule = KafkaConsumerHelperModule(option, injectMessageConsumerSymbol);
  const subscribeTopicModules = scanController(option, kafkaConnectionModule, injectMessageConsumerSymbol);

  class KafkaConsumerModule extends Module({requires: subscribeTopicModules}) {
    constructor(@Inject(injectMessageConsumerSymbol) private messageConsumer: MessageConsumer) {
      super();
    }

    async onCreate(): Promise<void> {
      await super.onCreate();
      await this.messageConsumer.open();
    }

    async onDestroy(): Promise<void> {
      await this.messageConsumer.close();
      return super.onDestroy();
    }
  }

  return Module({requires: [KafkaConsumerModule]});
}
