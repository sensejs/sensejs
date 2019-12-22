import 'reflect-metadata';
import Redis from 'ioredis';
import {Container, inject} from 'inversify';
import {Controller} from '@sensejs/http';
import {createModule, Inject, ModuleClass, ModuleRoot, OnModuleCreate} from '@sensejs/core';
import {InjectRedis, RedisModule, RedisModuleOptions} from '../src';

describe('RedisModule', () => {
  test('will throw without `name` field', (done) => {
    try {
      RedisModule([{options: {uri: '1'}, name: '1'}, {options: {uri: '2'}}]);

      done(new Error('error'));
    } catch (error) {
      done();
    }
  });

  test('will throw with duplicated `name` field', (done) => {
    try {
      RedisModule([
        {options: {uri: '1'}, name: '1'},
        {options: {uri: '2'}, name: '1'},
      ]);

      done(new Error('error'));
    } catch (error) {
      done();
    }
  });

  test('multi redis correct', async () => {
    const ConfigModule = createModule({constants: [{provide: 'config.redis', value: {uri: 'injected'}}]});
    const redisOption1: RedisModuleOptions = {
      options: {uri: ''},
      name: 'redis1',
    };

    const redisOption2: RedisModuleOptions = {
      requires: [ConfigModule],
      options: {uri: ''},
      name: 'redis2',
      injectOptionFrom: 'config.redis',
    };

    @Controller('/example')
    class ExampleHttpController {
      constructor(
        @InjectRedis(redisOption1.name) private redisClient: Redis.Redis,
        @InjectRedis(redisOption2.name) private redisClient1: Redis.Redis,
      ) {}

      async set1(key: string, value: string) {
        return this.redisClient.set(key, value);
      }

      async set2(key: string, value: string) {
        return this.redisClient1.set(key, value);
      }

      async get1(key: string) {
        return this.redisClient.get(key);
      }

      async get2(key: string) {
        return this.redisClient1.get(key);
      }
    }

    const redisModule = RedisModule([redisOption1, redisOption2]);

    const spy = jest.fn();

    @ModuleClass({
      components: [ExampleHttpController], requires: [redisModule],
    })
    class FooModule {
      constructor(@inject(Container) private container: Container) {}

      @OnModuleCreate()
      async onCreate() {
        const controller = this.container.get(ExampleHttpController);

        const key = 'commonKey';
        const value = 'commonValue';

        await controller.set1(key, value);
        const redis1Value = await controller.get1(key);
        const redis2Value = await controller.get2(key);

        expect(redis1Value).toEqual(value);
        expect(redis2Value).not.toEqual(value);

        await controller.set2(key, value);

        const redis2ValueNew = await controller.get2(key);
        expect(redis2ValueNew).toEqual(value);

        spy();
      }

    }

    const app = new ModuleRoot(FooModule);
    await app.start();
    await app.stop();

    expect(spy).toBeCalled();
  });

  test('redis', async () => {
    @Controller('/example')
    class ExampleHttpController {
      constructor(@InjectRedis() private redisClient: Redis.Redis) {}

      async set(key: string, value: string) {
        return this.redisClient.set(key, value);
      }

      async get(key: string) {
        return this.redisClient.get(key);
      }
    }

    const redisModule = RedisModule({
      options: {uri: ''},
    });

    const spy = jest.fn();

    @ModuleClass({
      components: [ExampleHttpController], requires: [redisModule],
    })
    class FooModule {

      @OnModuleCreate()
      async onCreate(@Inject(Container) container: Container) {
        const controller = container.get(ExampleHttpController);

        const key = 'testKey';
        const value = 'testValue';
        await controller.set(key, value);

        const redisValue = await controller.get(key);
        expect(redisValue).toEqual(value);
        spy();
      }
    }

    const app = new ModuleRoot(FooModule);
    await app.start();
    await app.stop();
    expect(spy).toBeCalled();
  });
});
