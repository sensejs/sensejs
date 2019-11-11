import {ApplicationFactory} from '@sensejs/core';
import {EventEmitter} from 'events';
import {ConsumerGroupPipeline, MessageConsumer} from 'kafka-pipeline';
import {KafkaSubscribeModule} from '../src';
import {SubscribeController, SubscribeTopic} from '../src/subscribe-decorators';

const mockController = new EventEmitter();
class MockConsumerGroupPipeline {
  private consumingPromise: Promise<unknown> = Promise.resolve();
  private topics: string[] = [];
  private messageConsumer: MessageConsumer;

  constructor(option: ConsumerGroupPipeline.Option) {
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
        this.consumingPromise = this.consumingPromise.then(() => this.messageConsumer(message));
      });
    });
  }
}

jest.mock('kafka-pipeline', (): unknown => {
  return {ConsumerGroupPipeline: MockConsumerGroupPipeline};
});

test('Subscriber', () => {
  test('', async () => {
    const startSpy = jest.spyOn(MockConsumerGroupPipeline.prototype, 'start');
    const stopSpy = jest.spyOn(MockConsumerGroupPipeline.prototype, 'close');
    const fooSpy = jest.fn;

    @SubscribeController()
    class Controller {
      @SubscribeTopic('foo')
      foo() {
        fooSpy();
      }
    }

    const module = KafkaSubscribeModule({
      components: [Controller],
      kafkaConnectOption: {kafkaHost: 'any', groupId: ''},
    });
    const app = new ApplicationFactory(module);
    await app.start();
    expect(startSpy).toBeCalled();
    mockController.emit('topic:foo', {topic: ''});
    await app.stop();
    expect(fooSpy).toBeCalled();
    expect(stopSpy).toBeCalled();
  });
});
