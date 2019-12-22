import {
  Class,
  composeRequestInterceptor,
  Constructor,
  createLegacyModule,
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
      @Inject(optionProvider.provide) config: ConsumeTopicOption,
      @Inject(injectSymbol) messageConsumer: MessageConsumer,
      @Inject(Container) container: Container,
    ) {
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

  @ModuleClass({
    requires: [createModule(option)],
    factories: [optionProvider, factoryProvider],
  })
  class KafkaConsumerGroupModule {
    constructor(
      @Inject(factoryProvider.factory) private consumerGroupFactory: InstanceType<typeof factoryProvider.factory>,
      @Inject(optionProvider.provide) private config: KafkaConsumerOption,
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

export function KafkaConsumerModuleClass(option: KafkaConsumerModuleOption) {
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
      await this.messageConsumer.open();
    }

    @OnModuleDestroy()
    async onDestroy(): Promise<void> {
      await this.messageConsumer.close();
    }
  }

  return ModuleClass({requires: [KafkaConsumerModule]});
}

export const KafkaConsumerModule = createLegacyModule(
  KafkaConsumerModuleClass,
  'Base class module style KafkaConsumerModule is deprecated, use KafkaConsumerModuleClass instead.',
);
