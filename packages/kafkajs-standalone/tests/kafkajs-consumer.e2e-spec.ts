import {MessageConsumer, MessageProducer} from '../src';
import {Subject} from 'rxjs';

const TOPIC = 'e2e-topic-' + Date.now();

test('KafkaJS', async () => {

  const producerA = new MessageProducer({
    connectOption: {brokers: ['kafka-1:9092'], clientId: 'kafkajs-1'},
    producerOption: {
      transactionalId: 'txid' + Date.now(),
    },
  });

  const firstMessage = new Date().toString();
  let stopped = false;
  await producerA.connect();
  await producerA.send(TOPIC, {key: new Date().toString(), value: firstMessage});

  async function sendBatch() {
    await producerA.sendBatch([{topic: TOPIC, messages: [{key: new Date().toString(), value: new Date().toString()}]}]);
    if (!stopped) {
      setTimeout(sendBatch, 1000);
    } else {
      await producerA.disconnect();
    }
  }

  await sendBatch();
  const observableA = new Subject(), observableB = new Subject();

  const consumerStubA = jest.fn().mockImplementationOnce(() => observableA.complete());
  const consumerStubB = jest.fn().mockImplementationOnce(() => observableB.complete());
  const messageConsumerA = new MessageConsumer({
    connectOption: {brokers: ['kafka-1:9092'], clientId: 'kafkajs-2'},
    fetchOption: {
      groupId: 'e2etest-latest',
    },
  });

  messageConsumerA.subscribe(TOPIC, async (message) => {
    consumerStubA(message.value.toString());
  });

  const messageConsumerB = new MessageConsumer({
    connectOption: {brokers: ['kafka-1:9092'], clientId: 'kafkajs-3'},
    fetchOption: {
      groupId: 'e2etest-earliest',
    },
  });

  messageConsumerB.subscribe(TOPIC, async (message) => {
    consumerStubB(message.value.toString());
  }, true);

  const p = Promise.all([observableA.toPromise(), observableB.toPromise()]);
  await messageConsumerA.start();
  await messageConsumerB.start();
  await p;
  stopped = true;
  await messageConsumerA.stop();
  await messageConsumerB.stop();
  expect(consumerStubA).toHaveBeenCalledWith(expect.not.stringMatching(firstMessage));
  expect(consumerStubB).toHaveBeenCalledWith(firstMessage);
}, 30000);
