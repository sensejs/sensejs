import '../src/index.js';
import {CompressionTypes, Kafka} from 'kafkajs';
import config from 'config';

test('ZSTD E2E test', async () => {
  const topic = 'test-zstd.' + Date.now();
  const data = 'test-data' + Date.now();
  const kafka = new Kafka({brokers: config.get('kafka.connectOption.brokers')});
  const producer = kafka.producer();
  await producer.connect();
  await producer.send({topic, messages: [{value: data}], compression: CompressionTypes.ZSTD});
  await producer.disconnect();
  const consumer = kafka.consumer({groupId: 'zstd-test-group.' + Date.now()});
  await consumer.subscribe({topic, fromBeginning: true});
  await new Promise((resolve, reject) => {
    consumer
      .run({
        eachMessage: async (param) => {
          expect(param.message.value?.toString()).toBe(data);
          consumer.stop().then(resolve);
        },
      })
      .catch(reject);
  });
  await consumer.disconnect();
}, 30000);
