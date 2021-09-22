import {
  Constructor,
  createModule,
  Inject,
  InjectLogger,
  Logger,
  ModuleClass,
  ModuleMetadata,
  ModuleOption,
  ModuleScanner,
  OnModuleCreate,
  OnModuleDestroy,
  OnStart,
  OnStop,
  ProcessManager,
  provideConnectionFactory,
  provideOptionInjector,
  ServiceIdentifier,
} from '@sensejs/core';
import {AsyncInterceptProvider, Container} from '@sensejs/container';
import {
  KafkaBatchConsumeMessageParam,
  KafkaReceivedMessage,
  MessageConsumer,
  MessageConsumerOption,
} from '@sensejs/kafkajs-standalone';
import {
  BatchedMessageConsumeContext,
  MessageConsumeContext,
  SimpleMessageConsumeContext,
} from './message-consume-context.js';
import lodash from 'lodash';
import {
  getSubscribeControllerMetadata,
  getSubscribeTopicMetadata,
  SubscribeControllerMetadata,
  SubscribeTopicMetadata,
  SubscribeTopicOption,
} from './consumer-decorators.js';
import {KafkaLogAdapterOption} from '@sensejs/kafkajs-standalone/src/logging';

export interface ConfigurableMessageConsumerOption extends Omit<MessageConsumerOption, 'logOption'> {
  logOption?: KafkaLogAdapterOption;
}

export interface MessageConsumerModuleOption extends ModuleOption {
  globalInterceptProviders?: Constructor<AsyncInterceptProvider>[];
  messageConsumerOption?: Partial<ConfigurableMessageConsumerOption>;
  injectOptionFrom?: ServiceIdentifier<ConfigurableMessageConsumerOption>;
  matchLabels?: (string | symbol)[] | Set<string | symbol> | ((labels: Set<string | symbol>) => boolean);
}

function mergeConnectOption(
  fallback?: Partial<ConfigurableMessageConsumerOption>,
  injected?: Partial<ConfigurableMessageConsumerOption>,
): ConfigurableMessageConsumerOption {
  const {connectOption, fetchOption, ...rest} = Object.assign({}, fallback, injected);
  if (typeof connectOption?.brokers === 'undefined') {
    throw new TypeError('connectOption.brokers not provided');
  }

  if (typeof fetchOption?.groupId === 'undefined') {
    throw new TypeError('fetchOption.groupId not provided');
  }
  return {connectOption, fetchOption, ...rest};
}

function getSubscribeOption(
  subscribeMetadata: SubscribeTopicMetadata,
  container: Container,
): {topic: string; fromBeginning?: boolean} {
  const {fallbackOption = {}, injectOptionFrom} = subscribeMetadata;
  const injected = injectOptionFrom ? container.resolve<SubscribeTopicOption>(injectOptionFrom) : {};

  const {topic, fromBeginning} = Object.assign({}, fallbackOption, injected);
  if (typeof topic !== 'string') {
    throw new TypeError('subscribe topic must be a string');
  }
  return {topic, fromBeginning};
}

function getSimpleConsumeCallback<T>(
  container: Container,
  interceptProviders: Constructor<AsyncInterceptProvider>[],
  consumerGroupId: string,
  target: Constructor<T>,
  method: keyof T,
) {
  const invoker = container.createMethodInvoker(
    target,
    method,
    interceptProviders,
    SimpleMessageConsumeContext,
    MessageConsumeContext,
  );
  return async (message: KafkaReceivedMessage) => {
    const context = new SimpleMessageConsumeContext(target, method, consumerGroupId, message);
    await invoker.createInvokeSession().invokeTargetMethod(context, context);
  };
}

function getBatchedConsumeCallback<T>(
  container: Container,
  interceptProviders: Constructor<AsyncInterceptProvider>[],
  consumerGroupId: string,
  target: Constructor<T>,
  method: keyof T,
) {
  const invoker = container.createMethodInvoker(
    target,
    method,
    interceptProviders,
    BatchedMessageConsumeContext,
    MessageConsumeContext,
  );
  return async (message: KafkaBatchConsumeMessageParam) => {
    const context = new BatchedMessageConsumeContext(target, method, consumerGroupId, message);
    await invoker.createInvokeSession().invokeTargetMethod(context, context);
  };
}

function scanPrototypeMethod(
  container: Container,
  messageConsumer: MessageConsumer,
  component: Constructor,
  controllerMetadata: SubscribeControllerMetadata,
  option: MessageConsumerModuleOption,
) {
  for (const [methodKey, pd] of Object.entries(Object.getOwnPropertyDescriptors(component.prototype))) {
    const subscribeMetadata = getSubscribeTopicMetadata(pd.value);
    const method = pd.value;

    if (!subscribeMetadata || method === undefined) {
      continue;
    }
    const {topic, fromBeginning} = getSubscribeOption(subscribeMetadata, container);
    const interceptProviders = [
      ...(option.globalInterceptProviders ?? []),
      ...controllerMetadata.interceptProviders,
      ...subscribeMetadata.interceptProviders,
    ];

    switch (subscribeMetadata.type) {
      case 'simple':
        {
          messageConsumer.subscribe(
            topic,
            getSimpleConsumeCallback(
              container,
              interceptProviders,
              messageConsumer.consumerGroupId,
              controllerMetadata.target,
              methodKey,
            ),
            fromBeginning,
          );
        }
        break;
      case 'batched': {
        messageConsumer.subscribeBatched({
          topic,
          consumer: getBatchedConsumeCallback(
            container,
            interceptProviders,
            messageConsumer.consumerGroupId,
            controllerMetadata.target,
            methodKey,
          ),
          fromBeginning,
        });
      }
    }
  }
}

function scanComponents(
  container: Container,
  messageConsumer: MessageConsumer,
  moduleMetadata: ModuleMetadata,
  option: MessageConsumerModuleOption,
) {
  [...moduleMetadata.components, ...(moduleMetadata.dynamicComponents ?? [])].forEach((component) => {
    const controllerMetadata = getSubscribeControllerMetadata(component);
    if (!controllerMetadata) {
      return;
    }
    if (typeof option.matchLabels === 'function') {
      if (!option.matchLabels(controllerMetadata.labels)) {
        return;
      }
    } else {
      const matchLabels = new Set(option.matchLabels);
      const intersectedLabels = lodash.intersection([...matchLabels], [...controllerMetadata.labels]);
      if (intersectedLabels.length !== matchLabels.size) {
        return;
      }
    }
    scanPrototypeMethod(container, messageConsumer, component, controllerMetadata, option);
  });
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
      @Inject(ProcessManager) private pm: ProcessManager,
    ) {}

    @OnStop()
    async onDestroy() {
      return this.messageConsumer.stop();
    }

    @OnStart()
    async onCreate(@Inject(ModuleScanner) moduleScanner: ModuleScanner) {
      moduleScanner.scanModule((moduleMetadata) => {
        scanComponents(this.container, this.messageConsumer, moduleMetadata, option);
      });
      const promise = this.messageConsumer.start();
      this.messageConsumer.wait().catch((e) => this.pm.shutdown(e));
      return promise;
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
      @InjectLogger() private logger: Logger,
      @Inject(factoryProvider.factory) private consumerGroupFactory: InstanceType<typeof factoryProvider.factory>,
      @Inject(optionProvider.provide) private config: ConfigurableMessageConsumerOption,
    ) {}

    @OnModuleCreate()
    async onCreate(): Promise<void> {
      await this.consumerGroupFactory.connect({
        ...this.config,
        logger: this.logger,
      });
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
