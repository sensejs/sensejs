import '@sensejs/testing-utility/lib/mock-console';
import {MessageConsumer, MessageProducer} from '../src';

async function prepareConsumeAndTopic(groupId: string, topic: string, message?: string) {
  const connectOption = {
    brokers: ['kafka-1:9092'],
  };
  const producer = new MessageProducer({
    connectOption,
  });

  const firstMessage = new Date().toString();
  await producer.connect();
  if (typeof message === 'string') {
    await producer.send(topic, {value: firstMessage});
  }

  await producer.disconnect();

  const consumer = new MessageConsumer({
    connectOption,
    fetchOption: {
      groupId,
      retry: {
        retries: 1,
        initialRetryTime: 0,
        maxRetryTime: 0,
      },
    },
  });
  return consumer;
}

test('Handle crash', async () => {
  const topic = 'handle-crash-e2e-topic-' + Date.now();
  const groupId = 'handle-crash-consumer-A' + Date.now();
  const consumer = await prepareConsumeAndTopic(groupId, topic, 'foobar');
  consumer.subscribe(topic, () => {
    throw new Error();
  });
  const started = consumer.start();
  await expect(consumer.wait()).rejects.toThrowError();
  await started;
  await consumer.stop();
  // Workaround bug of kafkajs teardown bug
  await new Promise((resolve) => setTimeout(resolve, 5000));
}, 30000);
