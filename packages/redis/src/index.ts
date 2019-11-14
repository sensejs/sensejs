import 'reflect-metadata';
import Redis from 'ioredis';
import {inject, named} from 'inversify';
import {
  Component,
  ComponentFactory,
  ComponentScope,
  Module,
  ModuleConstructor,
  ServiceIdentifier,
  ModuleOption,
} from '@sensejs/core';
import {createConfigHelperFactory} from '@sensejs/core';

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

function buildRedisModule(options: RedisModuleOptions): ModuleConstructor {
  @Component({scope: ComponentScope.SINGLETON})
  class RedisClientFactory extends ComponentFactory<Redis.Redis> {
    private redisClient?: Redis.Redis;

    async connect(options: RedisConnectOption): Promise<Redis.Redis> {
      this.redisClient = await new Promise<Redis.Redis>((done, fail) => {
        const {uri, ...rest} = options;
        const redisClient = typeof uri === 'string' ? new Redis(uri, rest) : new Redis(rest);
        const errorHandlerBeforeConnect = (error: Error) => fail(error);
        redisClient.once('connect', () => {
          redisClient.removeListener('error', errorHandlerBeforeConnect);
          return done(redisClient);
        });
        redisClient.once('error', errorHandlerBeforeConnect);
      });
      return this.redisClient;
    }

    build(): Redis.Redis {
      if (!this.redisClient) {
        throw new Error('Redis client is not yet setup');
      }
      return this.redisClient;
    }

    async close() {
      if (this.redisClient) {
        await this.redisClient.disconnect();
        delete this.redisClient;
      }
    }
  }

  const optionSymbol = Symbol();
  const ConfigFactory = createConfigHelperFactory(options.options, options.injectOptionFrom, (fallback, injected) => {
    return Object.assign({}, fallback, injected);
  });

  class RedisModule extends Module({
    requires: [Module(options)],
    components: [],
    // TODO: Factory scope is not correctly defined, set scope to ComponentScope.SINGLETON for work-around
    factories: [
      {provide: optionSymbol, scope: ComponentScope.SINGLETON, factory: ConfigFactory},
      {provide: Redis, name: options.name, scope: ComponentScope.SINGLETON, factory: RedisClientFactory},
    ],
  }) {
    constructor(
      @inject(RedisClientFactory) private redisClientFactory: RedisClientFactory,
      @inject(optionSymbol) private redisConnectOption: RedisConnectOption,
    ) {
      super();
    }

    async onCreate(): Promise<void> {
      await this.redisClientFactory.connect(this.redisConnectOption);
    }

    async onDestroy(): Promise<void> {
      await this.redisClientFactory.close();
    }
  }

  return RedisModule;
}
