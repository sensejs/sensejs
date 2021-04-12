import '@sensejs/testing-utility/lib/mock-console';
import {MessageConsumer, MessageProducer, SimpleKafkaJsProducerProvider} from '../src';
import {Subject} from 'rxjs';
import config from 'config';

const TOPIC = 'e2e-topic-' + Date.now();
const TX_TOPIC = 'e2e-tx-topic-' + Date.now();
const BATCH_TOPIC = 'e2e-batch-topic' + Date.now();

test('message producer e2e test', async () => {
  const transactionalId = 'transactionalId' + Date.now();
  const legacyTransactionalId = 'legacyTransactionalId' + Date.now();
  const provider = new SimpleKafkaJsProducerProvider({
    connectOption: config.get('kafka.connectOption'),
  });
  const legacyProducer = new MessageProducer({
    connectOption: config.get('kafka.connectOption'),
    producerOption: {
      transactionalId: legacyTransactionalId,
      messageKeyProvider: () => 'key',
    },
  });
  await legacyProducer.connect();

  const firstMessage = new Date().toString();
  let stopped = false;

  async function sendBatch() {
    const producerA = await provider.create();
    await producerA.sendMessage(TOPIC, {value: firstMessage});
    await legacyProducer.send(TOPIC, {value: firstMessage});
    while (!stopped) {
      await new Promise((done) => setTimeout(done, 1000));
      await producerA.sendMessageBatch([
        {
          topic: TOPIC,
          messages: [{value: new Date().toString()}],
        },
        {
          topic: BATCH_TOPIC,
          messages: [{value: new Date().toString()}],
        },
      ]);
      await legacyProducer.sendBatch([
        {
          topic: TOPIC,
          messages: [{value: new Date().toString()}],
        },
        {
          topic: BATCH_TOPIC,
          messages: [{value: new Date().toString()}],
        },
      ]);
    }
    await producerA.release();
  }

  const producingPromise = sendBatch();
  const observableA = new Subject(),
    observableBatchA = new Subject(),
    observableB = new Subject();

  const consumerStubA = jest.fn().mockImplementationOnce(() => observableA.complete());
  const batchedConsumerStubA = jest.fn().mockImplementationOnce(() => observableBatchA.complete());
  const consumerStubB = jest.fn().mockImplementationOnce(() => observableB.complete());
  const messageConsumerA = new MessageConsumer({
    connectOption: config.get('kafka.connectOption'),
    fetchOption: {
      groupId: 'e2etest-latest',
      retry: {
        retries: 1,
        initialRetryTime: 100,
      },
    },
    logOption: {
      level: 'NOTHING',
    },
  });

  messageConsumerA.subscribe(TOPIC, async (message) => {
    consumerStubA(message.value?.toString());
    expect(Buffer.isBuffer(message.key));
  });

  messageConsumerA.subscribeBatched({
    topic: BATCH_TOPIC,
    fromBeginning: false,
    consumer: async () => {
      batchedConsumerStubA();
    },
  });

  const messageConsumerB = new MessageConsumer({
    connectOption: config.get('kafka.connectOption'),
    fetchOption: {
      groupId: 'e2etest-earliest',
    },
  });

  messageConsumerB.subscribe(
    TOPIC,
    async (message) => {
      if (stopped) {
        return;
      }
      stopped = true;
      const {topic, partition, offset} = message;
      const producer = await provider.createTransactional(transactionalId);
      await producer.sendMessageBatch([
        {
          topic: TX_TOPIC,
          messages: [{key: new Date().toString(), value: new Date().toString()}],
        },
      ]);
      await producer.sendOffset('e2etest-earliest', {topics: [{topic, partitions: [{partition, offset}]}]});
      await producer.commit();
      await producer.release();
      await legacyProducer.sendBatch(
        [
          {
            topic: TX_TOPIC,
            messages: [{key: new Date().toString(), value: new Date().toString()}],
          },
        ],
        {
          transactional: true,
          transactionalCommit: {
            consumerGroupId: 'e2etest-earliest',
            offsets: {topics: [{topic, partitions: [{partition, offset}]}]},
          },
        },
      );
      consumerStubB(message.value?.toString());
    },
    true,
  );

  const p = Promise.all([observableA.toPromise(), observableBatchA.toPromise(), observableB.toPromise()]);
  await messageConsumerA.start();
  await messageConsumerA.start(); // safe to call start multiple times
  await messageConsumerB.start();
  await p;
  await producingPromise;
  await messageConsumerA.stop();
  await messageConsumerA.stop(); // safe to call stop multiple times
  await messageConsumerB.stop();
  await legacyProducer.disconnect();
  await provider.destroy();
  expect(consumerStubA).toHaveBeenCalledWith(expect.not.stringMatching(firstMessage));
  expect(consumerStubB).toHaveBeenCalledWith(firstMessage);
}, 60000);
