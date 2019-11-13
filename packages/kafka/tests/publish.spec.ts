import {EventEmitter} from 'events';

class MockKafkaClient extends EventEmitter {
  options = {
    idleConnection: 100,
  };

  constructor() {
    super();
    mockController.once('KafkaClient:ready', () => this.emit('ready'));
  }

  refreshMetadata(topics: string[], callback: Function) {
    return process.nextTick(() => callback());
  }

  loadMetadataForTopics(topics: string[], callback: Function) {
    return process.nextTick(() => callback());
  }
}

class MockHighLevelProducer extends EventEmitter {
  private sendPromise: Promise<any> = Promise.resolve();

  constructor(private client: MockKafkaClient) {
    super();
    mockController.once('Producer:ready', () => this.emit('ready'));
  }

  send(payloads: ProduceRequest[], cb: (error: any, data: any) => any): void {
    const result = new Promise((done) => {
      mockController.once('Producer:sent', done);
      mockController.emit('Producer.sendRequest');
    });
    this.sendPromise = this.sendPromise
      .then(() => result)
      .then(
        () => cb(null, null),
        (e) => cb(e, null),
      );
  }

  close(callback: Function) {
    return this.sendPromise.then(() => callback());
  }
}

jest.mock('kafka-node', () => {
  return {
    KafkaClient: MockKafkaClient,
    HighLevelProducer: MockHighLevelProducer,
  };
});

import {ApplicationFactory, Module} from '@sensejs/core';
import {inject} from 'inversify';
import {ProduceRequest} from 'kafka-node';
import {KafkaPublishModule} from '../src';
import {MessageProducer} from '../src/message-producer';
const mockController = new EventEmitter();

describe('MessageProducerModule', () => {
  test('Module', async () => {
    const spy = jest.spyOn(MockHighLevelProducer.prototype, 'send');

    class WrappedKafkaModule extends KafkaPublishModule({
      kafkaProducerOption: {kafkaHost: ''},
    }) {
      onCreate() {
        const promise = super.onCreate();
        mockController.emit('Producer:ready');
        return promise;
      }
    }

    class Foo extends Module({requires: [WrappedKafkaModule]}) {
      constructor(@inject(MessageProducer) messageProducer: MessageProducer) {
        super();
        messageProducer.produceMessage('topic', '1', 'key');
        messageProducer.produceMessage('topic', '2', 'key');
        messageProducer.produceMessage('topic', '3', 'key');
      }
    }

    const app = new ApplicationFactory(Foo);

    // Wait till first send request
    await new Promise((done) => {
      mockController.once('Producer.sendRequest', () => {
        expect(spy).toHaveBeenLastCalledWith(
          [expect.objectContaining({topic: 'topic', messages: '1', key: 'key'})],
          expect.any(Function),
        );
        done();
      });
      app.start();
    });

    // Wait till the second send request
    await new Promise((done) => {
      mockController.once('Producer.sendRequest', () => {
        // should batch the 2nd and 3rd message
        expect(spy).toHaveBeenLastCalledWith(
          [
            expect.objectContaining({topic: 'topic', messages: '2', key: 'key'}),
            expect.objectContaining({topic: 'topic', messages: '3', key: 'key'}),
          ],
          expect.any(Function),
        );
        done();
      });
      // Finish first send request
      mockController.emit('Producer:sent');
    });
    mockController.emit('Producer:sent');
    await app.stop();
  });
});
