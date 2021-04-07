jest.mock('@sensejs/kafkajs-standalone');
import '@sensejs/testing-utility/lib/mock-console';
import {MessageProducer} from '@sensejs/kafkajs-standalone';
import {createModule, Inject, ModuleClass, ModuleRoot} from '@sensejs/core';
import {createMessageProducerModule} from '../src';
import {Subject} from 'rxjs';

describe('MessageProducerModule', () => {
  beforeEach(() => {
    jest.spyOn(MessageProducer.prototype, 'connect').mockResolvedValue();
    jest.spyOn(MessageProducer.prototype, 'disconnect').mockResolvedValue();
  });
  test('Module', async () => {
    const onProducerSend = new Subject<void>();
    const spy = jest.spyOn(MessageProducer.prototype, 'send').mockImplementation(async () => {
      onProducerSend.next();
      return [];
    });

    const kafkaProducerModule = createMessageProducerModule({
      messageProducerOption: {connectOption: {brokers: ['']}},
    });

    @ModuleClass({requires: [kafkaProducerModule]})
    class Foo {
      constructor(@Inject(MessageProducer) messageProducer: MessageProducer) {
        messageProducer.send('topic', {value: '1'});
        messageProducer.send('topic', {value: '2'});
        messageProducer.send('topic', {value: '3'});
      }
    }

    const moduleRoot = new ModuleRoot(Foo);
    await moduleRoot.start();
    await moduleRoot.stop();
    expect(spy).toHaveBeenNthCalledWith(1, 'topic', expect.objectContaining({value: '1'}));
    expect(spy).toHaveBeenNthCalledWith(2, 'topic', expect.objectContaining({value: '2'}));
    expect(spy).toHaveBeenNthCalledWith(3, 'topic', expect.objectContaining({value: '3'}));
  });

  test('injected config', async () => {
    const brokers = new Date().toISOString();

    const ConfigModule = createModule({
      constants: [{provide: 'config.kafkaProducer', value: {connectOption: {brokers}}}],
    });

    const moduleRoot = new ModuleRoot(
      createMessageProducerModule({
        requires: [ConfigModule],
        messageProducerOption: {
          producerOption: {
            transactionTimeout: 1000,
          },
        },
        injectOptionFrom: 'config.kafkaProducer',
      }),
    );
    await moduleRoot.start();
    expect(MessageProducer).toHaveBeenCalledWith(
      expect.objectContaining({
        connectOption: expect.objectContaining({
          brokers,
        }),
        producerOption: expect.objectContaining({
          transactionTimeout: 1000,
        }),
      }),
    );
  });
});
