jest.mock('kafka-node', () => {
  class MockKafkaClient extends EventEmitter {
    options = {
      idleConnection: 100,
    };

    constructor(...args: any) {
      super();
      mockController.once('KafkaClient:ready', () => this.emit('ready'));
      mockController.emit('MockKafkaClient:constructor', args);
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

      setImmediate(() => {
        mockController.once('Producer:ready', () => {
          this.emit('ready');
        });
        mockController.emit('Producer:constructor');
      });
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

  return {
    KafkaClient: MockKafkaClient,
    HighLevelProducer: MockHighLevelProducer,
  };
});

import {EventEmitter} from 'events';
import {Module, ModuleRoot} from '@sensejs/core';
import {inject} from 'inversify';
import {HighLevelProducer, ProduceRequest} from 'kafka-node';
import {KafkaProducerModule} from '../src';
import {MessageProducer} from '../src/message-producer';

const mockController = new EventEmitter();

describe('MessageProducerModule', () => {
  test('Module', async () => {
    const spy = jest.spyOn(HighLevelProducer.prototype, 'send');

    class Foo extends Module({
      requires: [KafkaProducerModule({kafkaProducerOption: {kafkaHost: ''}})],
    }) {
      constructor(@inject(MessageProducer) messageProducer: MessageProducer) {
        super();
        messageProducer.produceMessage('topic', '1', 'key');
        messageProducer.produceMessage('topic', '2', 'key');
        messageProducer.produceMessage('topic', '3', 'key');
      }
    }

    const moduleRoot = new ModuleRoot(Foo);

    // Wait till first send request
    await new Promise((done) => {
      mockController.once('Producer.sendRequest', () => {
        expect(spy).toHaveBeenLastCalledWith(
          [expect.objectContaining({topic: 'topic', messages: '1', key: 'key'})],
          expect.any(Function),
        );
        done();
      });
      mockController.once('Producer:constructor', () => {
        mockController.emit('Producer:ready');
      });
      moduleRoot.start();
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
    await moduleRoot.stop();
  });

  test('injected config', async () => {
    const kafkaHost = new Date().toISOString();

    const stub = jest.fn();
    mockController.once('MockKafkaClient:constructor', stub);

    const ConfigModule = Module({
      constants: [{provide: 'config.kafkaProducer', value: {kafkaHost}}],
    });

    const producerModule = KafkaProducerModule({
      requires: [ConfigModule],
      injectOptionFrom: 'config.kafkaProducer',
    });

    const moduleRoot = new ModuleRoot(producerModule);
    mockController.once('Producer:constructor', () => {
      mockController.emit('Producer:ready');
    });
    const promise = moduleRoot.start().then(() => {
      expect(stub).toHaveBeenCalledWith([
        expect.objectContaining({
          kafkaHost,
        }),
      ]);
    });
    mockController.once('MyKafkaModule.onCreate', () => mockController.emit('KafkaClient:ready'));
    return promise;
  });
});
