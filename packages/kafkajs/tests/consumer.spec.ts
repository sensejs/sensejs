jest.mock('@sensejs/kafkajs-standalone');
import {Component, createModule, Inject, ModuleRoot, RequestInterceptor} from '@sensejs/core';
import {MessageConsumer} from '@sensejs/kafkajs-standalone';
import {
  ConsumerContext,
  createKafkaConsumerModule,
  InjectSubscribeContext,
  Message,
  SubscribeController,
  SubscribeTopic,
} from '../src';
import {Subject} from 'rxjs';

describe('Subscribe decorators', () => {
  test('Missing param binding', () => {
    expect(() => {
      class Controller {
        @SubscribeTopic({option: {topic: 'foo'}})
        foo(value: any) {}
      }
    }).toThrow();
  });

  test('Duplicated @SubscribeTopic', () => {
    expect(() => {
      class Controller {
        @SubscribeTopic({option: {topic: 'foo'}})
        @SubscribeTopic({option: {topic: 'bar'}})
        foo() {}
      }
    }).toThrow();
  });

  test('Duplicated @SubscribeController', () => {
    expect(() => {
      @SubscribeController()
      @SubscribeController()
      class Controller {}
    }).toThrow();
  });
});

describe('Subscriber', () => {
  test('consume message', async () => {
    const startSpy = jest.spyOn(MessageConsumer.prototype, 'start');
    const stopSpy = jest.spyOn(MessageConsumer.prototype, 'stop').mockResolvedValue();

    function mockSubscribe(this: MessageConsumer, topic: string, callback: Function) {
      expect(startSpy).not.toHaveBeenCalled();
      startSpy.mockImplementation(async () => {
        setImmediate(() => {
          callback({topic: 'foo', value: 'value', key: 'key', partition: 0, offset: '0'});
        });
      });
      return this;
    }

    const subscribeSpy = jest.spyOn(MessageConsumer.prototype, 'subscribe').mockImplementation(mockSubscribe);
    const symbolA = Symbol(),
      symbolB = Symbol(),
      symbolC = Symbol();
    const makeInterceptor = (symbol: symbol) => {
      @Component()
      class Interceptor extends RequestInterceptor<ConsumerContext> {
        async intercept(context: ConsumerContext, next: () => Promise<void>): Promise<void> {
          context.bindContextValue(symbol, Math.random());
          await next();
        }
      }

      return Interceptor;
    };
    const interceptorA = makeInterceptor(symbolA),
      interceptorB = makeInterceptor(symbolB),
      interceptorC = makeInterceptor(symbolC);

    const consumerReceivedMessage = new Subject();

    @SubscribeController({interceptors: [interceptorB]})
    class Controller {
      @SubscribeTopic({option: {topic: 'foo'}, interceptors: [interceptorC]})
      foo(
        @InjectSubscribeContext() ctx: ConsumerContext,
        @Inject(symbolA) global: any,
        @Inject(symbolB) controller: any,
        @Inject(symbolC) fromTopic: any,
        @Message() message: string | Buffer,
      ) {
        consumerReceivedMessage.complete();
      }
    }

    const module = createKafkaConsumerModule({
      components: [Controller],
      messageConsumerOption: {
        connectOption: {
          brokers: 'any-host',
        },
        fetchOption: {
          groupId: 'any-group',
        },
      },
      globalInterceptors: [interceptorA],
    });
    const moduleRoot = new ModuleRoot(module);
    await moduleRoot.start();
    expect(startSpy).toBeCalled();
    expect(subscribeSpy).toBeCalledTimes(1);
    expect(subscribeSpy).toBeCalledWith('foo', expect.any(Function), undefined);
    await consumerReceivedMessage.toPromise();
    await moduleRoot.stop();
    expect(stopSpy).toBeCalled();
  });

  test('injected config', async () => {
    jest.spyOn(MessageConsumer.prototype, 'start').mockResolvedValue();
    jest.spyOn(MessageConsumer.prototype, 'stop').mockResolvedValue();
    const brokers = `host_${Date.now()}`; // for random string
    const groupId = `group_${Date.now()}`;
    const topic = `topic_${Date.now()}`;

    @SubscribeController()
    class Controller {
      @SubscribeTopic({injectOptionFrom: 'config.consumer.topic'})
      foo() {}
    }

    const ConfigModule = createModule({
      constants: [
        {
          provide: 'config.consumer',
          value: {
            connectOption: {brokers},
          },
        },
        {
          provide: 'config.consumer.topic',
          value: {
            topic,
          },
        },
      ],
    });

    const moduleRoot = new ModuleRoot(createKafkaConsumerModule({
      components: [Controller],
      requires: [ConfigModule],
      messageConsumerOption: {
        fetchOption: {
          groupId,
        },
      },
      injectOptionFrom: 'config.consumer',
    }));
    await moduleRoot.start();

    expect(MessageConsumer).toHaveBeenCalledWith(expect.objectContaining({
      connectOption: expect.objectContaining({
        brokers,
      }),
    }));
  });
});
