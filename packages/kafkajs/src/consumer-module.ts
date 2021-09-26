import {
  Constructor,
  Inject,
  InjectLogger,
  Logger,
  ModuleClass,
  ModuleMetadata,
  ModuleOption,
  ModuleScanner,
  OnStart,
  OnStop,
  ProcessManager,
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

export interface MessageConsumerModuleOption {
  globalInterceptProviders?: Constructor<AsyncInterceptProvider>[];
  messageConsumerOption?: Partial<ConfigurableMessageConsumerOption>;
  injectOptionFrom?: ServiceIdentifier<ConfigurableMessageConsumerOption>;
  matchLabels?: (string | symbol)[] | Set<string | symbol> | ((labels: Set<string | symbol>) => boolean);
}

export interface CreateMessageConsumerModuleOption extends ModuleOption, MessageConsumerModuleOption {}

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

export class AbstractKafkaConsumerGroupModule {
  private readonly messageConsumer;

  constructor(option: ConfigurableMessageConsumerOption, private moduleOption: MessageConsumerModuleOption) {
    this.messageConsumer = new MessageConsumer(option);
  }

  @OnStart()
  async onStart(
    @Inject(ModuleScanner) moduleScanner: ModuleScanner,
    @Inject(Container) container: Container,
    @Inject(ProcessManager) pm: ProcessManager,
  ): Promise<void> {
    moduleScanner.scanModule((moduleMetadata) => {
      scanComponents(container, this.messageConsumer, moduleMetadata, this.moduleOption);
    });
    const promise = this.messageConsumer.start();
    this.messageConsumer.wait().catch((e) => pm.shutdown(e));
    return promise;
  }

  @OnStop()
  async onStop(): Promise<void> {
    return this.messageConsumer.stop();
  }
}

/**
 * Create kafka consumer module for sense.js framework
 * @param option
 */
export function createMessageConsumerModule(option: CreateMessageConsumerModuleOption): Constructor {
  const {requires, components, factories, constants, ...rest} = option;
  const optionProvider = provideOptionInjector(
    option.messageConsumerOption,
    option.injectOptionFrom,
    mergeConnectOption,
  );

  @ModuleClass({
    factories: [optionProvider, ...(factories ?? [])],
    constants,
    components,
    requires,
  })
  class KafkaConsumerGroupModule extends AbstractKafkaConsumerGroupModule {
    constructor(
      @InjectLogger() logger: Logger,
      @Inject(optionProvider.provide) config: ConfigurableMessageConsumerOption,
    ) {
      super({logger, ...config}, rest);
    }
  }

  return KafkaConsumerGroupModule;
}
