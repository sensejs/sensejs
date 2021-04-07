import config from 'config';
import {SimpleKafkaJsProducerProvider} from '../src/simple-provider';
import {PooledKafkaJsProducerProvider} from '../src/pooled-provider';

test('Simple provider create simple producer', async () => {
  const provider = new SimpleKafkaJsProducerProvider(config.get('kafka'));
  const producer = await provider.create();
  await producer.sendMessage('foo', {value: 'bar'});
  await producer.sendMessageBatch('foo', [{value: 'bar'}]);
  await producer.sendMessageBatch([{topic: 'foo', messages: [{value: 'bar'}]}]);
  const releasedPromise = producer.release();
  await expect(producer.sendMessage('foo', {value: 'bar'})).rejects.toBeInstanceOf(Error);
  await releasedPromise;
  await provider.destroy();
});

test('Simple provider create transactional producer', async () => {
  const txId = Math.random().toString();
  const provider = new SimpleKafkaJsProducerProvider(config.get('kafka'));
  const producer = await provider.createTransactional(txId);
  await producer.sendMessage('foo', {value: 'bar'});
  await producer.sendMessageBatch('foo', [{value: 'bar'}]);
  await producer.sendMessageBatch([{topic: 'foo', messages: [{value: 'bar'}]}]);
  const releasedPromise = producer.release();
  await expect(producer.sendMessage('foo', {value: 'bar'})).rejects.toBeInstanceOf(Error);
  await releasedPromise;
  await provider.destroy();
});
test('Pooled provider create simple producer', async () => {
  const provider = new PooledKafkaJsProducerProvider(config.get('kafka'));
  const producer = await provider.create();
  await producer.sendMessage('foo', {value: 'bar'});
  await producer.sendMessageBatch('foo', [{value: 'bar'}]);
  await producer.sendMessageBatch([{topic: 'foo', messages: [{value: 'bar'}]}]);
  const releasedPromise = producer.release();
  await expect(producer.sendMessage('foo', {value: 'bar'})).rejects.toBeInstanceOf(Error);
  await releasedPromise;
  await provider.destroy();
});

test('Pooled provider create transactional producer', async () => {
  const txId = Math.random().toString();
  const provider = new PooledKafkaJsProducerProvider(config.get('kafka'));
  const producer = await provider.createTransactional(txId);
  await producer.sendMessage('foo', {value: 'bar'});
  await producer.sendMessageBatch('foo', [{value: 'bar'}]);
  await producer.sendMessageBatch([{topic: 'foo', messages: [{value: 'bar'}]}]);
  const releasedPromise = producer.release();
  await expect(producer.sendMessage('foo', {value: 'bar'})).rejects.toBeInstanceOf(Error);
  await releasedPromise;
  await provider.destroy();
});
