import {
  Abstract,
  ComponentScope,
  composeRequestInterceptor,
  createConfigHelperFactory,
  createConnectionFactory,
  invokeMethod,
  Module,
  ModuleConstructor,
  ModuleOption,
  RequestInterceptor,
  ServiceIdentifier,
} from '@sensejs/core';
import {Container, inject} from 'inversify';
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
  globalInterceptors?: Abstract<RequestInterceptor>[];
  defaultKafkaConsumerOption?: Partial<KafkaConsumerOption>;
  injectOptionFrom?: ServiceIdentifier<unknown>;
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
  messageConsumerModule: ModuleConstructor,
  option: KafkaConsumerModuleOption,
  controllerMetadata: SubscribeControllerMetadata,
  subscribeMetadata: SubscribeTopicMetadata,
  method: Function,
) {
  const {fallbackOption, injectOptionFrom} = subscribeMetadata;
  const ConfigHelper = createConfigHelperFactory(fallbackOption, injectOptionFrom, (a, b) => {
    return Object.assign({}, a, b);
  });
  const symbol = Symbol();

  class TopicModule extends Module({
    requires: [messageConsumerModule],
    factories: [{provide: symbol, factory: ConfigHelper}],
  }) {
    constructor(
      @inject(symbol) config: ConsumeTopicOption,
      @inject(MessageConsumer) messageConsumer: MessageConsumer,
      @inject(Container) container: Container,
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

function scanController(option: KafkaConsumerModuleOption, module: ModuleConstructor) {
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
      );
      result.push(subscribeTopicModule);
    }
  }
  return result;
}

export function KafkaConsumerModule(option: KafkaConsumerModuleOption): ModuleConstructor {
  const ConfigFactory = createConfigHelperFactory(
    option.defaultKafkaConsumerOption,
    option.injectOptionFrom,
    mergeConnectOption,
  );
  const ConsumerGroupFactory = createConnectionFactory<MessageConsumer, ConnectOption>(
    async (option) => new MessageConsumer(option),
    async (messageConsumer) => undefined, // close on KafkaConsumerModule
  );
  const configSymbol = Symbol();

  class KafkaConsumerGroupModule extends Module({
    requires: [Module(option)],
    factories: [
      {provide: configSymbol, factory: ConfigFactory, scope: ComponentScope.SINGLETON},
      {provide: MessageConsumer, factory: ConsumerGroupFactory, scope: ComponentScope.SINGLETON},
    ],
  }) {
    constructor(
      @inject(ConsumerGroupFactory) private consumerGroupFactory: InstanceType<typeof ConsumerGroupFactory>,
      @inject(configSymbol) private config: KafkaConsumerOption,
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

  const subscribeTopicModules = scanController(option, KafkaConsumerGroupModule);

  class KafkaConsumerModule extends Module({requires: subscribeTopicModules}) {
    constructor(@inject(MessageConsumer) private messageConsumer: MessageConsumer) {
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

  return KafkaConsumerModule;
}
