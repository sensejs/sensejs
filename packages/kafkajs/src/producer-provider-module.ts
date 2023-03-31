import {
  Constructor,
  DynamicModuleLoader,
  Inject,
  InjectLogger,
  ModuleClass,
  ModuleOption,
  OnModuleCreate,
  OnModuleDestroy,
  provideOptionInjector,
  ServiceIdentifier,
} from '@sensejs/core';
import {
  MessageProducerOption,
  MessageProducerProvider,
  PooledKafkaJsProducerProvider,
  PooledMessageProducerOption,
} from '@sensejs/kafkajs-standalone';
import _ from 'lodash';
import {Logger} from '@sensejs/utility';

export type ConfigurableMessageProducerOption = Exclude<MessageProducerOption, 'logger'>;
export type ConfigurablePooledMessageProducerOption = Exclude<PooledMessageProducerOption, 'logger'>;

export interface SimpleProducerModuleOption extends ModuleOption {
  kafkaProducerOption?: Partial<ConfigurableMessageProducerOption>;
  injectOptionFrom?: ServiceIdentifier<Partial<ConfigurableMessageProducerOption>>;
}

export interface PooledProducerModuleOption extends ModuleOption {
  kafkaProducerOption?: Partial<ConfigurablePooledMessageProducerOption>;
  injectOptionFrom?: ServiceIdentifier<Partial<ConfigurablePooledMessageProducerOption>>;
}

class AbstractProducerModuleBase {
  readonly #producer;
  constructor(producer: MessageProducerProvider) {
    this.#producer = producer;
  }

  @OnModuleCreate()
  async onModuleCreate(@Inject(DynamicModuleLoader) loader: DynamicModuleLoader) {
    loader.addConstant({provide: MessageProducerProvider, value: this.#producer});
  }

  @OnModuleDestroy()
  async onModuleDestroy() {
    await this.#producer.destroy();
  }
}

export class AbstractPooledProducerModule extends AbstractProducerModuleBase {
  constructor(option: PooledMessageProducerOption) {
    super(new PooledKafkaJsProducerProvider(option));
  }
}

export class AbstractSimpleProducerModule extends AbstractProducerModuleBase {
  constructor(option: PooledMessageProducerOption) {
    super(new PooledKafkaJsProducerProvider(option));
  }
}

export function createPooledProducerModule(option: PooledProducerModuleOption): Constructor {
  const {factories, injectOptionFrom, kafkaProducerOption, ...rest} = option;

  const configurationFactory = provideOptionInjector(kafkaProducerOption, injectOptionFrom, (fallback, injected) =>
    _.merge({}, fallback, injected),
  );

  @ModuleClass({factories: [configurationFactory, ...(factories ?? [])], ...rest})
  class PooledProducerModule extends AbstractPooledProducerModule {
    constructor(@InjectLogger() logger: Logger, @Inject(configurationFactory.provide) option: MessageProducerOption) {
      super({...option, logger});
    }
  }
  return PooledProducerModule;
}

export function createSimpleProducerModule(option: SimpleProducerModuleOption): Constructor {
  const {factories, injectOptionFrom, kafkaProducerOption, ...rest} = option;

  const configurationFactory = provideOptionInjector(kafkaProducerOption, injectOptionFrom, (fallback, injected) =>
    _.merge({}, fallback, injected),
  );

  @ModuleClass({factories: [configurationFactory, ...(factories ?? [])], ...rest})
  class SimpleProducerModule extends AbstractSimpleProducerModule {
    constructor(@InjectLogger() logger: Logger, @Inject(configurationFactory.provide) option: MessageProducerOption) {
      super({...option, logger});
    }
  }
  return SimpleProducerModule;
}
