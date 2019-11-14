import 'reflect-metadata';
import Redis from 'ioredis';
import {inject, named} from 'inversify';
import {Component, ComponentFactory, ComponentScope, Module, ModuleConstructor} from '@sensejs/core';

export interface RedisModuleOptions {
  uri?: string;
  name?: string | symbol;
  options?: Redis.RedisOptions;
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

    async connect(options: RedisModuleOptions): Promise<Redis.Redis> {
      this.redisClient = await new Promise<Redis.Redis>((done, fail) => {
        const redisClient = options.uri ? new Redis(options.uri) : new Redis(options.options);
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

  class RedisModule extends Module({
    components: [],
    // TODO: Factory scope is not correctly defined, set scope to ComponentScope.SINGLETON for work-around
    factories: [{provide: Redis, name: options.name, scope: ComponentScope.SINGLETON, factory: RedisClientFactory}],
  }) {
    constructor(@inject(RedisClientFactory) private redisClientFactory: RedisClientFactory) {
      super();
    }

    async onCreate(): Promise<void> {
      await this.redisClientFactory.connect(options);
    }

    async onDestroy(): Promise<void> {
      await this.redisClientFactory.close();
    }
  }

  return RedisModule;
}
