jest.mock('@sensejs/kafkajs-standalone');
import '@sensejs/testing-utility/lib/mock-console';
import {Component, createModule, Inject, LoggerBuilder, ProcessManager, RequestInterceptor} from '@sensejs/core';
import {MessageConsumer} from '@sensejs/kafkajs-standalone';
import {
  MessageConsumeContext,
  createMessageConsumerModule,
  InjectSubscribeContext,
  Message,
  SubscribeController,
  SubscribeTopic,
} from '../src';
import {Subject} from 'rxjs';
import {ApplicationRunner} from '@sensejs/core/lib/entry-point';

describe('Subscribe decorators', () => {
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
  const brokers = `host_${Date.now()}`; // for random string
  const groupId = `group_${Date.now()}`;
  const topic = `topic_${Date.now()}`;
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

  const makeInterceptor = (symbol: symbol) => {
    @Component()
    class Interceptor extends RequestInterceptor<MessageConsumeContext> {
      async intercept(context: MessageConsumeContext, next: () => Promise<void>): Promise<void> {
        context.bindContextValue(symbol, Math.random());
        await next();
      }
    }

    return Interceptor;
  };

  test('consume message', async () => {
    const startSpy = jest.spyOn(MessageConsumer.prototype, 'start').mockResolvedValue();
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
    const interceptorA = makeInterceptor(symbolA),
      interceptorB = makeInterceptor(symbolB),
      interceptorC = makeInterceptor(symbolC);

    @SubscribeController({interceptors: [interceptorB]})
    class Controller {
      @SubscribeTopic({
        injectOptionFrom: 'config.consumer.topic',
        option: {fromBeginning: true},
        interceptors: [interceptorC],
      })
      foo(
        @InjectSubscribeContext() ctx: MessageConsumeContext,
        @Inject(symbolA) global: any,
        @Inject(symbolB) controller: any,
        @Inject(symbolC) fromTopic: any,
        @Message() message: string | Buffer,
        @Inject(ProcessManager) processManager: ProcessManager,
      ) {
        processManager.shutdown();
      }
    }

    const module = createMessageConsumerModule({
      requires: [ConfigModule, createModule({components: [Controller]})],
      messageConsumerOption: {
        connectOption: {
          brokers: 'any-host',
        },
        fetchOption: {
          groupId,
        },
      },
      injectOptionFrom: 'config.consumer',
      globalInterceptors: [interceptorA],
    });
    const exitSubject = new Subject();

    await ApplicationRunner.runModule(module, {
      onExit: () => {
        exitSubject.complete();
        return undefined as never;
      },
    });
    await exitSubject.toPromise();

    expect(MessageConsumer).toHaveBeenCalledWith(
      expect.objectContaining({
        connectOption: expect.objectContaining({
          brokers,
        }),
      }),
    );

    expect(startSpy).toBeCalled();
    expect(subscribeSpy).toBeCalledTimes(1);
    expect(subscribeSpy).toBeCalledWith(topic, expect.any(Function), true);
    expect(stopSpy).toBeCalled();
  });
});
