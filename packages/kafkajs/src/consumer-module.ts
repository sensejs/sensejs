import {
  Constructor,
  createModule,
  Inject,
  InjectLogger,
  Logger,
  ModuleClass,
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
} from './message-consume-context';
import lodash from 'lodash';
import {
  getSubscribeControllerMetadata,
  getSubscribeTopicMetadata,
  SubscribeControllerMetadata,
  SubscribeTopicMetadata,
  SubscribeTopicOption,
} from './consumer-decorators';
import {KafkaLogAdapterOption} from '@sensejs/kafkajs-standalone/src/logging';

export interface ConfigurableMessageConsumerOption extends Omit<MessageConsumerOption, 'logOption'> {
  logOption?: KafkaLogAdapterOption;
}

export interface MessageConsumerModuleOption extends ModuleOption {
  // globalInterceptors?: Constructor<RequestInterceptor<MessageConsumeContext>>[];
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

function scanSubscriber(
  option: MessageConsumerModuleOption,
  connectionModule: Constructor,
  messageConsumerSymbol: symbol,
) {
  @ModuleClass({
    requires: [connectionModule],
  })
  class SubscriberScanModule {
    // private methodInvokerBuilder = MethodInvokerBuilder.create<MessageConsumeContext>(this.container);
    constructor(
      @Inject(Container) private container: Container,
      @Inject(messageConsumerSymbol) private messageConsumer: MessageConsumer,
      @Inject(ProcessManager) private pm: ProcessManager,
    ) {
      // if (option.globalInterceptors) {
      //   this.methodInvokerBuilder.addInterceptor(...option.globalInterceptors);
      // }
    }

    @OnStart()
    async onCreate(@Inject(ModuleScanner) moduleScanner: ModuleScanner) {
      moduleScanner.scanModule((moduleMetadata) => {
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
          this.scanPrototypeMethod(component, controllerMetadata);
        });
      });

      const promise = this.messageConsumer.start();
      this.messageConsumer.wait().catch((e) => this.pm.shutdown(e));
      return promise;
    }

    @OnStop()
    async onDestroy() {
      return this.messageConsumer.stop();
    }

    private scanPrototypeMethod(component: Constructor, controllerMetadata: SubscribeControllerMetadata) {
      for (const [methodKey, propertyDescriptor] of Object.entries(
        Object.getOwnPropertyDescriptors(component.prototype),
      )) {
        const subscribeMetadata = getSubscribeTopicMetadata(propertyDescriptor.value);
        const method = propertyDescriptor.value;

        if (!subscribeMetadata || method === undefined) {
          continue;
        }

        const {fallbackOption = {}, injectOptionFrom} = subscribeMetadata;
        const injected = injectOptionFrom ? this.container.resolve<SubscribeTopicOption>(injectOptionFrom) : {};

        const subscribeOption = Object.assign({}, fallbackOption, injected);
        if (typeof subscribeOption.topic !== 'string') {
          throw new TypeError('subscribe topic must be a string');
        }
        const {topic, fromBeginning} = subscribeOption;
        switch (subscribeMetadata.type) {
          case 'simple':
            {
              const consumeCallback = this.getConsumeCallback(controllerMetadata, subscribeMetadata, methodKey);
              this.messageConsumer.subscribe(topic, consumeCallback, fromBeginning);
            }
            break;
          case 'batched': {
            const consumer = this.getBatchConsumerCallback(controllerMetadata, subscribeMetadata, methodKey);
            this.messageConsumer.subscribeBatched({topic, consumer, fromBeginning, autoResolve: false});
          }
        }
      }
    }

    private getConsumeCallback<T>(
      controllerMetadata: SubscribeControllerMetadata,
      subscribeMetadata: SubscribeTopicMetadata,
      method: keyof T,
    ) {
      const target = controllerMetadata.target;
      const invoker = this.container.createMethodInvoker(
        target,
        method,
        [
          ...(option.globalInterceptProviders ?? []),
          ...controllerMetadata.interceptProviders,
          ...subscribeMetadata.interceptProviders,
        ],
        SimpleMessageConsumeContext,
        MessageConsumeContext,
      );
      return async (message: KafkaReceivedMessage) => {
        const context = new SimpleMessageConsumeContext(target, method, this.messageConsumer.consumerGroupId, message);
        await invoker.createInvokeSession().invokeTargetMethod(context, context);
      };
    }
    private getBatchConsumerCallback<T>(
      controllerMetadata: SubscribeControllerMetadata,
      subscribeMetadata: SubscribeTopicMetadata,
      method: keyof T,
    ) {
      const target = controllerMetadata.target;
      const invoker = this.container.createMethodInvoker(
        target,
        method,
        [
          ...(option.globalInterceptProviders ?? []),
          ...controllerMetadata.interceptProviders,
          ...subscribeMetadata.interceptProviders,
        ],
        BatchedMessageConsumeContext,
        MessageConsumeContext,
      );
      return async (batch: KafkaBatchConsumeMessageParam) => {
        const context = new BatchedMessageConsumeContext(target, method, this.messageConsumer.consumerGroupId, batch);
        await invoker.createInvokeSession().invokeTargetMethod(context, context);
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
      @InjectLogger() private logger: Logger,
      @Inject(factoryProvider.factory) private consumerGroupFactory: InstanceType<typeof factoryProvider.factory>,
      @Inject(optionProvider.provide) private config: ConfigurableMessageConsumerOption,
    ) {}

    @OnModuleCreate()
    async onCreate(): Promise<void> {
      const {...rest} = this.config;
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
