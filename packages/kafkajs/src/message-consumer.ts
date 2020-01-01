import {Consumer, ConsumerConfig, EachBatchPayload, Kafka, KafkaConfig, KafkaMessage} from 'kafkajs';
import {Subject} from 'rxjs';
import Long from 'long';

type KafkaConnectOption = Omit<KafkaConfig, 'logLevel' | 'logCreator'>;

interface MessageConsumerOption {
  connectOption: KafkaConnectOption;
  subscribeOption: ConsumerConfig;
  consumeOption?: {
    commitInterval: number
  };
  logOption: {
    // TODO: ...
  };
}

interface ConsumeOption {
  consumer: (message: KafkaMessage, topic: string, partition: number) => Promise<void>;
  fromBeginning: boolean;
}

export class MessageConsumer {
  private client: Kafka;
  private consumer: Consumer;
  private consumeOptions: Map<string, ConsumeOption> = new Map();
  private runPromise?: Promise<unknown>;
  private abortConsuming = new Subject<{notify: (promise: Promise<void>) => void; allConfirmed: Subject<void>}>();

  constructor(private option: MessageConsumerOption) {
    this.client = new Kafka(option.connectOption);
    this.consumer = this.client.consumer(option.subscribeOption);
  }

  subscribe(topic: string, consumer: (message: KafkaMessage) => Promise<void>, fromBeginning: boolean = false): this {
    this.consumeOptions.set(topic, {consumer, fromBeginning});
    return this;
  }

  async start() {
    const topics = Array.from(this.consumeOptions.keys());
    const admin = this.client.admin();
    try {
      await admin.connect();
      const metadata = await this.client.admin().fetchTopicMetadata({topics});

      const totalPartitions = metadata.topics
        .reduce((result, topicMetadata) => result + topicMetadata.partitions.length, 0);

      for (const topicMetadata of metadata.topics) {
        await this.consumer.subscribe({topic: topicMetadata.name});
      }

      this.runPromise = this.consumer.run({
        autoCommit: true,
        autoCommitInterval: this.option.consumeOption?.commitInterval,
        eachBatchAutoResolve: false,
        partitionsConsumedConcurrently: totalPartitions,
        eachBatch: this.eachBatch.bind(this),
      });
    } finally {
      await admin.disconnect();
    }
  }

  async stop() {
    const allConfirmed = new Subject<void>();
    const promises: Promise<void>[] = [];
    this.abortConsuming.next({
      notify: (promise) => {
        promises.push(promise);
      },
      allConfirmed,
    });
    await Promise.all(promises);
    const stopPromise = this.consumer.stop();
    allConfirmed.complete();
    await stopPromise;
  }

  private subscribeAbortEvent() {

    let shouldAbort: (() => (() => void) | undefined) = () => void 0;
    const subscription = this.abortConsuming.subscribe({
      next: ({notify, allConfirmed}) => {
        subscription.unsubscribe();
        return notify(new Promise((resolve) => {
          shouldAbort = () => resolve;
        }));
      },
    });
    const check = async (beforeAbort: () => Promise<void>) => {
      const confirmStop = shouldAbort();
      if (typeof confirmStop !== 'undefined') {
        await beforeAbort();
        confirmStop();
        return true;
      }
      return false;
    };
    return {
      check,
      unsubscribe: () => {
        subscription.unsubscribe();
      },
    };
  }

  private async eachBatch(payload: EachBatchPayload) {
    const forceCommitOffset = (offset: string) => {
      return payload.commitOffsetsIfNecessary({
        topics: [
          {
            topic,
            partitions: [{partition, offset: Long.fromValue(offset).add(1).toString()}],
          },
        ],
      });
    };
    const subscription = this.subscribeAbortEvent();

    const {topic, partition} = payload.batch;
    const consumeOption = this.consumeOptions.get(topic);
    if (!consumeOption) {
      throw new Error('Message received from unsubscribed topic');
    }

    try {
      for (const message of payload.batch.messages) {
        await consumeOption.consumer(message, topic, partition);
        payload.resolveOffset(message.offset);
        try {
          await payload.heartbeat();
        } catch (e) {
          if (e.type === 'REBALANCE_IN_PROGRESS' || e.type === 'NOT_COORDINATOR_FOR_GROUP') {
            let allPartitionAborted = Promise.resolve();
            const notify = (promise: Promise<void>) => {
              allPartitionAborted = allPartitionAborted.then(() => promise);
            };
            const allConfirmed = new Subject<void>();
            this.abortConsuming.next({
              notify,
              allConfirmed,
            });
            // await payload.commitOffsetsIfNecessary(await payload.uncommittedOffsets());
            await subscription.check(() => forceCommitOffset(message.offset));
            await allPartitionAborted;
            allConfirmed.complete();
            return;
          }
        }
        if (await subscription.check(() => Promise.resolve())) {
          return;
        }
        await payload.commitOffsetsIfNecessary();

      }
    } finally {
      subscription.unsubscribe();
    }
  }

}
