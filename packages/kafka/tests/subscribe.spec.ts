jest.mock('kafka-pipeline', (): unknown => {
  class MockConsumerGroupPipeline {
    private consumingPromise: Promise<unknown> = Promise.resolve();
    private topics: string[] = [];
    private messageConsumer: Function;

    constructor(option: any) {
      this.topics = this.topics.concat(option.topic);
      this.messageConsumer = option.messageConsumer;
    }

    async close(): Promise<void> {
      await this.consumingPromise;
    }

    async wait(): Promise<void> {
      await this.consumingPromise;
    }

    async start(): Promise<void> {
      this.topics.forEach((topic) => {
        mockController.on(`message:${topic}`, (message) => {
          this.consumingPromise = this.consumingPromise.then(() => {
            return this.messageConsumer(message);
          });
        });
      });
    }
  }

  return {ConsumerGroupPipeline: MockConsumerGroupPipeline};
});
import {ApplicationFactory, RequestInterceptor, ParamBinding, Component} from '@sensejs/core';
import {EventEmitter} from 'events';
import {ConsumerGroupPipeline} from 'kafka-pipeline';
import {KafkaSubscribeModule} from '../src';
import {InjectSubscribeContext, Message, SubscribeContext} from '../src/subscribe-context';
import {SubscribeController, SubscribeTopic} from '../src/subscribe-decorators';

const mockController = new EventEmitter();

describe('Subscribe decorators', () => {
  test('Missing param binding', () => {
    expect(() => {
      class Controller {
        @SubscribeTopic('foo')
        foo(value: any) {}
      }
    }).toThrow();
  });

  test('Duplicated @SubscribeTopic', () => {
    expect(() => {
      class Controller {
        @SubscribeTopic('foo')
        @SubscribeTopic('bar')
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
    const startSpy = jest.spyOn(ConsumerGroupPipeline.prototype, 'start');
    const stopSpy = jest.spyOn(ConsumerGroupPipeline.prototype, 'close');
    const fooSpy = jest.fn();
    const symbolA = Symbol(),
      symbolB = Symbol(),
      symbolC = Symbol();
    const makeInterceptor = (symbol: symbol) => {
      @Component()
      class Interceptor extends RequestInterceptor<SubscribeContext> {
        async intercept(context: SubscribeContext, next: () => Promise<void>): Promise<void> {
          context.bindContextValue(symbol, Math.random());
          await next();
        }
      }
      return Interceptor;
    };
    const interceptorA = makeInterceptor(symbolA),
      interceptorB = makeInterceptor(symbolB),
      interceptorC = makeInterceptor(symbolC);

    @SubscribeController({interceptors: [interceptorB]})
    class Controller {
      @SubscribeTopic('foo', {interceptors: [interceptorC]})
      foo(
        @InjectSubscribeContext() ctx: SubscribeContext,
        @ParamBinding(symbolA) global: any,
        @ParamBinding(symbolB) controller: any,
        @ParamBinding(symbolC) fromTopic: any,
        @Message() message: string | Buffer,
      ) {
        fooSpy();
      }
    }

    const module = KafkaSubscribeModule({
      components: [Controller, interceptorA, interceptorB, interceptorC],
      kafkaConnectOption: {kafkaHost: 'any', groupId: ''},
      globalInterceptors: [interceptorA],
    });
    const app = new ApplicationFactory(module);
    await app.start();
    expect(startSpy).toBeCalled();
    mockController.emit('message:foo', {topic: ''});
    await app.stop();
    expect(fooSpy).toBeCalled();
    expect(stopSpy).toBeCalled();
  });
});
