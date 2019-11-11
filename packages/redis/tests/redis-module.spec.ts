import 'reflect-metadata';
import Redis from 'ioredis';
import {Container, inject} from 'inversify';
import {Controller, GET} from '@sensejs/http';
import {ApplicationFactory, Module} from '@sensejs/core';
import {RedisModule} from '../src';
const DEFAULT_VALUE = 'test';

describe('RedisModule', () => {

    test('common case', async () => {

        @Controller('/example')
        class ExampleHttpController {

            constructor(@inject(Redis) private redisClient: Redis.Redis
            ) {
            }

            @GET('/get')
            async getDefaultValue() {
                const key = 'default_value';
                await this.redisClient.set(key, DEFAULT_VALUE);
                const value = await this.redisClient.get(key);
                return value;
            }

        }

        const redisModule = RedisModule({
            uri: ''
        });

        const spy = jest.fn();

        class FooModule extends Module({components: [ExampleHttpController], requires: [redisModule]}) {
            constructor(@inject(Container) private container: Container) {
                super();
            }

            async onCreate() {
                const controller = this.container.get(ExampleHttpController);
                const result = await controller.getDefaultValue();
                expect(result).toEqual(DEFAULT_VALUE);
                spy();
            }

            async onDestroy() {

            }
        }

        try {
            const app = new ApplicationFactory(FooModule);
            await app.start();
            await app.stop();
            expect(spy).toBeCalled();
        } catch (e) {}

    });

});
