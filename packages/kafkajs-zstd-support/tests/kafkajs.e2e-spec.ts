import '../src';
import {CompressionTypes, Kafka} from 'kafkajs';
import config from 'config';
console.log('node env', process.env.NODE_ENV);

test('ZSTD E2E test', async () => {
  const topic = 'test-zstd.' + Date.now();
  const data = 'test-data' + Date.now();
  const kafka = new Kafka({brokers: config.get('kafka.connectOption.brokers')});
  const producer = kafka.producer();
  await producer.connect();
  await producer.send({topic, messages: [{value: topic}], compression: CompressionTypes.ZSTD});
  await producer.disconnect();
  const consumer = kafka.consumer({groupId: 'zstd-test-group.' + Date.now()});
  await consumer.subscribe({topic});
  await new Promise((resolve, reject) => {
    consumer
      .run({
        eachMessage: async (param) => {
          expect(param.message.value).toBe(data);
          consumer.stop().then(resolve);
        },
      })
      .catch(reject);
  });
  await consumer.disconnect();
});
