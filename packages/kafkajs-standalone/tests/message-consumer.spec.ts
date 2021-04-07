const mockedConstructor = jest.fn();

function MockKafka(...args: unknown[]) {
  mockedConstructor(...args);
}

const mockedConsumer = {
  subscribe: jest.fn(), run: jest.fn(),
  stop: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  commitOffsets: jest.fn()
};

const mockedAdmin = {fetchTopicMetadata: jest.fn(), connect: jest.fn(), disconnect: jest.fn()};

MockKafka.prototype.admin = jest.fn();
MockKafka.prototype.consumer = jest.fn();

jest.mock('kafkajs', () => {
  return {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'Kafka': MockKafka,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    logLevel: { NOTHING: 0, ERROR: 1, WARN: 2, INFO: 4, DEBUG: 5, }
  };
});

import {KafkaConnectOption, KafkaFetchOption, MessageConsumer} from '../src';
import {Subject} from 'rxjs';

function createFakeMessageBatch(topic: string, partition: number) {

  return {
    batch: {
      topic, partition, messages: [
        {
          offset: '1',
          value: Buffer.from(''),
          timestamp: new Date().toISOString(),
          headers: {},
          attributes: 0,
          size: 0,
          key: Buffer.from(''),
        },
      ],
    },
    uncommittedOffsets: jest.fn(),
    heartbeat: jest.fn(),
    resolveOffset: jest.fn(),
    commitOffsetsIfNecessary: jest.fn(),
  };
}

test('MessageConsumer', async () => {
  mockedAdmin.fetchTopicMetadata.mockImplementation(async (arg: {topics: string[]}) => {
    return {
      topics: arg.topics.map((topic) => {
        return {topic, partitions: [{partitionId: 0}, {partitionId: 1}]};
      }),
    };
  });
  mockedConsumer.commitOffsets.mockResolvedValue(void 0);
  MockKafka.prototype.admin.mockReturnValue(mockedAdmin);
  MockKafka.prototype.consumer.mockReturnValue(mockedConsumer);
  const connectOption: KafkaConnectOption = {
    brokers: ['foo', 'bar'],
  };
  const fetchOption: KafkaFetchOption = {
    groupId: 'foobar',
  };

  const spy = jest.spyOn(MockKafka.prototype, 'consumer');

  const messageConsumer = new MessageConsumer({
    connectOption,
    fetchOption,
  });
  expect(mockedConstructor).toHaveBeenCalledWith(expect.objectContaining({
    ...connectOption,
  }));
  expect(spy).toHaveBeenCalledWith(expect.objectContaining({...fetchOption}));

  const consumerCallback = jest.fn().mockResolvedValue(void 0);
  messageConsumer.subscribe('topic1', consumerCallback);
  messageConsumer.subscribe('topic2', consumerCallback);
  const allFakeBatchConsumed = new Subject();
  mockedConsumer.run.mockImplementation(async ({eachBatch}) => {
    const batch1 = createFakeMessageBatch('topic1', 1);
    await eachBatch(batch1);
    const batch2 = createFakeMessageBatch('topic1', 2);
    batch2.heartbeat.mockRejectedValue({type: 'REBALANCE_IN_PROGRESS'});
    await eachBatch(batch2);
    // TODO: More assertion here
    allFakeBatchConsumed.complete();
  });

  await messageConsumer.start();
  await messageConsumer.start();
  await allFakeBatchConsumed.toPromise();
  mockedConsumer.stop.mockResolvedValue(void 0);
  await messageConsumer.stop();
  await messageConsumer.stop();

  expect(mockedAdmin.fetchTopicMetadata).toHaveBeenCalledWith({topics: expect.arrayContaining(['topic1', 'topic2'])});

});
