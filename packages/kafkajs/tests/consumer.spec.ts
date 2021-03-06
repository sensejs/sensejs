import {Batch, EachBatchPayload} from 'kafkajs';
import '@sensejs/testing-utility/lib/mock-console';
import {Component, createModule, Inject, ProcessManager, RequestInterceptor} from '@sensejs/core';
import {BatchSubscribeOption, MessageConsumer} from '@sensejs/kafkajs-standalone';
import {
  BatchedMessageConsumeContext,
  BatchedSubscribeTopic,
  createMessageConsumerModule,
  MessageConsumeContext,
  SimpleMessageConsumeContext,
  SubscribeController,
  SubscribeTopic,
} from '../src';
import {Subject} from 'rxjs';
import {ApplicationRunner} from '@sensejs/core/lib/entry-point';

jest.mock('@sensejs/kafkajs-standalone');

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
  const batchedTopic = `topic_${Date.now()}`;
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
    jest.spyOn(MessageConsumer.prototype, 'wait').mockResolvedValue();
    const emitBatchMessage = jest.fn();

    function mockSubscribe(this: MessageConsumer, topic: string, callback: Function) {
      expect(startSpy).not.toHaveBeenCalled();
      startSpy.mockImplementation(async () => {
        setImmediate(() => {
          callback({topic, value: 'value', key: 'key', partition: 0, offset: '0'});
        });
      });
      return this;
    }

    function mockSubscribeBatched(this: MessageConsumer, option: BatchSubscribeOption) {
      expect(emitBatchMessage).not.toHaveBeenCalled();
      emitBatchMessage.mockImplementation(async () => {
        setImmediate(() => {
          option.consumer({
            batch: {
              topic: option.topic,
              messages: [
                {
                  value: Buffer.from('value'),
                  key: Buffer.from('key'),
                  timestamp: new Date().toISOString(),
                  size: 0,
                  attributes: 0,
                  headers: {},
                  offset: '0',
                },
              ],
              partition: 0,
              firstOffset: () => '0',
              lastOffset: () => '1',
            } as Batch,
            heartbeat: jest.fn(),
            resolveOffset: jest.fn(),
          } as unknown as EachBatchPayload);
        });
      });
      return this;
    }

    const subscribeSpy = jest.spyOn(MessageConsumer.prototype, 'subscribe').mockImplementation(mockSubscribe);
    jest.spyOn(MessageConsumer.prototype, 'subscribeBatched').mockImplementation(mockSubscribeBatched);
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
      simple(
        @Inject(SimpleMessageConsumeContext) ctx: MessageConsumeContext,
        @Inject(symbolA) global: any,
        @Inject(symbolB) controller: any,
        @Inject(symbolC) fromTopic: any,
        @Inject(ProcessManager) processManager: ProcessManager,
      ) {
        // TODO: Perform e2e test to make following assert possible
        emitBatchMessage();
      }

      @BatchedSubscribeTopic({
        option: {fromBeginning: true, topic: batchedTopic},
        interceptors: [interceptorC],
      })
      batched(
        @Inject(BatchedMessageConsumeContext) ctx: BatchedMessageConsumeContext,
        @Inject(ProcessManager) processManager: ProcessManager,
      ) {
        // TODO: Perform e2e test to make following assert possible
        // expect(ctx.consumerGroup).toBe(groupId);
        // expect(ctx.partition);
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
