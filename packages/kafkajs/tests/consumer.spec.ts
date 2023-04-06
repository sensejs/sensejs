import '@sensejs/testing-utility/lib/mock-console';
import {jest} from '@jest/globals';
jest.mock('@sensejs/kafkajs-standalone');

import {Batch, EachBatchPayload, KafkaMessage} from 'kafkajs';
import {ApplicationRunner, createModule, Inject, ProcessManager} from '@sensejs/core';
import {BatchSubscribeOption, MessageConsumer} from '@sensejs/kafkajs-standalone';
import {
  BatchedMessageConsumeContext,
  BatchedSubscribeTopic,
  createMessageConsumerModule,
  MessageConsumeContext,
  SimpleMessageConsumeContext,
  SubscribeController,
  SubscribeTopic,
} from '../src/index.js';
import {lastValueFrom, Subject} from 'rxjs';
import {MiddlewareClass} from '@sensejs/container';

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

  const makeMiddleware = (symbol: symbol) => {
    @MiddlewareClass(symbol)
    class TestMiddleware {
      async handle(next: (value: any) => Promise<void>): Promise<void> {
        await next(Math.random());
      }
    }

    return TestMiddleware;
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
                  attributes: 0,
                  headers: {},
                  offset: '0',
                },
              ],
              partition: 0,
              firstOffset: () => '0',
              lastOffset: () => '1',
              highWatermark: '0',
              isEmpty: () => false,
              offsetLag: () => '0',
              offsetLagLow: () => '0',
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
    const interceptorA = makeMiddleware(symbolA),
      interceptorB = makeMiddleware(symbolB);
    @MiddlewareClass(symbolC)
    class MiddlewareC {
      async handle(next: (value: any) => Promise<void>): Promise<void> {
        await next(Math.random());
      }
    }

    @SubscribeController({middlewares: [interceptorB]})
    class Controller {
      @SubscribeTopic({
        injectOptionFrom: 'config.consumer.topic',
        option: {fromBeginning: true},
        middlewares: [MiddlewareC],
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
        middlewares: [MiddlewareC],
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
      middlewares: [interceptorA],
    });
    const exitSubject = new Subject();

    await ApplicationRunner.instance.runModule(module, {
      onExit: () => {
        exitSubject.complete();
        return undefined as never;
      },
    });
    await lastValueFrom(exitSubject, {defaultValue: 0});

    expect(startSpy).toBeCalled();
    expect(subscribeSpy).toBeCalledTimes(1);
    expect(subscribeSpy).toBeCalledWith(topic, expect.any(Function), true);
    expect(stopSpy).toBeCalled();
  });
});
