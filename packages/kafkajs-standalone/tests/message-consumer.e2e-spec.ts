import '@sensejs/testing-utility/lib/mock-console';
import {MessageConsumer, SimpleKafkaJsProducerProvider} from '../src';
import config from 'config';

async function prepareConsumeAndTopic(groupId: string, topic: string, message?: string) {
  const connectOption = config.get('kafka.connectOption') as any;
  const provider = new SimpleKafkaJsProducerProvider({
    connectOption,
  });
  const producer = await provider.create();

  const firstMessage = new Date().toString();
  if (typeof message === 'string') {
    await producer.sendMessage(topic, {value: firstMessage});
  }

  await producer.release();
  await provider.destroy();

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
    logOption: {
      level: 'NOTHING',
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
