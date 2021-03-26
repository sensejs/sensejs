import {
  Constructor,
  createModule,
  Inject,
  LoggerBuilder,
  MethodInvokerBuilder,
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
import {Container} from '@sensejs/container';
import {KafkaReceivedMessage, MessageConsumer, MessageConsumerOption} from '@sensejs/kafkajs-standalone';
import {MessageConsumeContext} from './message-consume-context';
import lodash from 'lodash';
import {
  getSubscribeControllerMetadata,
  getSubscribeTopicMetadata,
  SubscribeControllerMetadata,
  SubscribeTopicOption,
} from './consumer-decorators';
import {createLogOption, KafkaLogAdapterOption} from './logging';

export interface ConfigurableMessageConsumerOption extends Omit<MessageConsumerOption, 'logOption'> {
  logOption?: KafkaLogAdapterOption;
}

export interface MessageConsumerModuleOption extends ModuleOption {
  globalInterceptors?: Constructor<RequestInterceptor<MessageConsumeContext>>[];
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
    private methodInvokerBuilder = MethodInvokerBuilder.create<MessageConsumeContext>(this.container);
    constructor(
      @Inject(Container) private container: Container,
      @Inject(messageConsumerSymbol) private messageConsumer: MessageConsumer,
    ) {
      if (option.globalInterceptors) {
        this.methodInvokerBuilder.addInterceptor(...option.globalInterceptors);
      }
    }

    @OnModuleCreate()
    async onCreate(@Inject(ModuleScanner) moduleScanner: ModuleScanner) {
      moduleScanner.scanModule((moduleMetadata) => {
        moduleMetadata.components.forEach((component) => {
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

      return this.messageConsumer.start();
    }

    @OnModuleDestroy()
    async onDestroy() {
      return this.messageConsumer.stop();
    }

    private scanPrototypeMethod(component: Constructor, controllerMetadata: SubscribeControllerMetadata) {
      const methodInvokerBuilder = this.methodInvokerBuilder.clone().addInterceptor(...controllerMetadata.interceptors);
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

        const consumeCallback = this.getConsumeCallback(
          methodInvokerBuilder.clone().addInterceptor(...subscribeMetadata.interceptors),
          controllerMetadata.target,
          methodKey,
        );
        this.messageConsumer.subscribe(subscribeOption.topic, consumeCallback, subscribeOption.fromBeginning);
      }
    }

    private getConsumeCallback<T>(
      methodInvokerBuilder: MethodInvokerBuilder<MessageConsumeContext>,
      target: Constructor<T>,
      method: keyof T,
    ) {
      return async (message: KafkaReceivedMessage) => {
        await methodInvokerBuilder.build(target, method).invoke({
          contextFactory: (resolveContext, targetConstructor, targetMethodKey) => {
            return new MessageConsumeContext(
              resolveContext,
              message,
              this.messageConsumer.consumerGroupId,
              targetConstructor,
              targetMethodKey,
            );
          },
          contextIdentifier: MessageConsumeContext,
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
      @Inject(LoggerBuilder) private loggerBuilder: LoggerBuilder,
      @Inject(factoryProvider.factory) private consumerGroupFactory: InstanceType<typeof factoryProvider.factory>,
      @Inject(optionProvider.provide) private config: ConfigurableMessageConsumerOption,
    ) {}

    @OnModuleCreate()
    async onCreate(): Promise<void> {
      const {logOption, ...rest} = this.config;
      await this.consumerGroupFactory.connect({
        logOption: createLogOption(this.loggerBuilder, logOption),
        ...rest,
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
