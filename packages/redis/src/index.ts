import 'reflect-metadata';
import Redis from 'ioredis';
import {inject} from 'inversify';
import {Component, ComponentFactory, ComponentScope, Module, ModuleConstructor} from '@sensejs/core';

export interface RedisModuleOptions {
  uri?: string;
  port?: number;
  host?: string;
  options?: Redis.RedisOptions;
}

export function RedisModule(options: RedisModuleOptions): ModuleConstructor {
  @Component({scope: ComponentScope.SINGLETON})
  class RedisClientFactory extends ComponentFactory<Redis.Redis> {
    private redisClient?: Redis.Redis;

    async connect(options: RedisModuleOptions): Promise<Redis.Redis> {
      this.redisClient = await new Promise<Redis.Redis>((done, fail) => {
        const redisClient =
          options.uri && typeof options.uri === 'string'
            ? new Redis(options.uri)
            : new Redis(options.port, options.host, options.options);
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
    factories: [{provide: Redis, scope: ComponentScope.SINGLETON, factory: RedisClientFactory}],
  }) {
    constructor(@inject(RedisClientFactory) private redisClientFactory: RedisClientFactory) {
      super();
    }

    async onCreate(): Promise<void> {
      super.onCreate();
      await this.redisClientFactory.connect(options);
    }

    async onDestroy(): Promise<void> {
      await this.redisClientFactory.close();
    }
  }

  return RedisModule;
}
