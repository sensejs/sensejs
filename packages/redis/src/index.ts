import Redis from 'ioredis';
import {inject, named} from 'inversify';
import {
  Module,
  ModuleConstructor,
  ModuleOption,
  provideConnectionFactory,
  provideOptionInjector,
  ServiceIdentifier,
} from '@sensejs/core';

export interface RedisConnectOption extends Redis.RedisOptions {
  uri?: string;
}

export interface RedisModuleOptions extends ModuleOption {
  name?: string | symbol;
  options?: RedisConnectOption;
  injectOptionFrom?: ServiceIdentifier<RedisConnectOption>;
}

export function InjectRedis(name?: string | symbol) {
  return (target: any, key: string, index?: number) => {
    inject(Redis)(target, key, index);
    if (name) {
      named(name)(target, key, index);
    }
  };
}

function checkRedisOptions(options: RedisModuleOptions[]) {
  const names: (string | symbol)[] = [];
  for (const option of options) {
    if (!option.name) {
      throw new Error('multi redis need `name` field');
    }

    if (names.includes(option.name)) {
      throw new Error('multi redis `name` duplicated');
    }

    names.push(option.name);
  }
}

export function RedisModule(options: RedisModuleOptions | RedisModuleOptions[]): ModuleConstructor {
  options = ([] as RedisModuleOptions[]).concat(options);

  if (options.length === 1) {
    return buildRedisModule(options[0]);
  }

  checkRedisOptions(options);

  return Module({
    requires: options.map((option) => buildRedisModule(option)),
  });
}

function createRedisConnection(options: RedisConnectOption) {
  return new Promise<Redis.Redis>((done, fail) => {
    const {uri, ...rest} = options;
    const redisClient = typeof uri === 'string' ? new Redis(uri, rest) : new Redis(rest);
    const errorHandlerBeforeConnect = (error: Error) => fail(error);
    redisClient.once('connect', () => {
      redisClient.removeListener('error', errorHandlerBeforeConnect);
      return done(redisClient);
    });
    redisClient.once('error', errorHandlerBeforeConnect);
  });
}

function destroyRedisConnection(connection: Redis.Redis) {
  return Promise.resolve(connection.disconnect());
}

function buildRedisModule(options: RedisModuleOptions): ModuleConstructor {
  const factoryProvider = provideConnectionFactory(createRedisConnection, destroyRedisConnection, Redis);
  const optionProvider = provideOptionInjector(options.options, options.injectOptionFrom, (fallback, injected) => {
    return Object.assign({}, fallback, injected);
  });
  Object.assign(factoryProvider, {name: options.name});

  class RedisModule extends Module({
    requires: [Module(options)],
    factories: [factoryProvider, optionProvider],
  }) {
    constructor(
      @inject(factoryProvider.factory) private redisClientFactory: InstanceType<typeof factoryProvider.factory>,
      @inject(optionProvider.provide) private redisConnectOption: RedisConnectOption,
    ) {
      super();
    }

    async onCreate(): Promise<void> {
      await this.redisClientFactory.connect(this.redisConnectOption);
    }

    async onDestroy(): Promise<void> {
      await this.redisClientFactory.disconnect();
    }
  }

  return Module({requires: [RedisModule]});
}
