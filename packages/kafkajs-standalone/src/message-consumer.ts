import kafkajs from 'kafkajs';
import {WorkerController} from './worker-synchronizer.js';
import {createKafkaClient} from './create-client.js';
import {KafkaBatchConsumeMessageParam, KafkaClientOption, KafkaReceivedMessage} from './types.js';

export interface KafkaFetchOption extends Exclude<kafkajs.ConsumerConfig, 'retry'> {
  retry?: kafkajs.RetryOptions;
}

export interface KafkaCommitOption {
  commitInterval: number;
}

export interface MessageConsumerOption extends KafkaClientOption {
  fetchOption: KafkaFetchOption;
  commitOption?: KafkaCommitOption;
}

export interface MessageConsumeCallback {
  (message: KafkaReceivedMessage): Promise<void>;
}

export interface BatchMessageConsumeCallback {
  (message: KafkaBatchConsumeMessageParam): Promise<void>;
}

export interface SimpleConsumeOption {
  type: 'simple';
  consumer: MessageConsumeCallback;
  fromBeginning: boolean;
}

export interface BatchConsumeOption {
  type: 'batch';
  consumer: BatchMessageConsumeCallback;
  fromBeginning?: boolean;
  autoResolveBatch?: boolean;
}

export interface BatchSubscribeOption {
  topic: string;
  consumer: BatchMessageConsumeCallback;
  fromBeginning?: boolean;
  autoResolve?: boolean;
}

type ConsumeOption = SimpleConsumeOption | BatchConsumeOption;

export class MessageConsumer {
  private client: kafkajs.Kafka;
  private consumer: kafkajs.Consumer;
  private consumeOptions: Map<string, ConsumeOption> = new Map();
  private crashPromise?: Promise<void>;
  private lastBatchConsumed: Promise<unknown> = Promise.resolve();
  private workerController = new WorkerController<boolean>();
  private startedPromise?: Promise<void>;
  private stoppedPromise?: Promise<void>;
  private commitOption?: KafkaCommitOption;
  public readonly consumerGroupId;

  constructor(option: MessageConsumerOption) {
    this.client = createKafkaClient(option);
    const {retry, ...rest} = option.fetchOption;
    let crashed!: (e: Error) => void;
    this.crashPromise = new Promise<void>((resolve, reject) => {
      crashed = reject;
    });

    this.consumer = this.client.consumer({
      retry: {
        ...retry,
        restartOnFailure: async (e) => {
          crashed(e);
          return false;
        },
      },
      ...rest,
    });
    this.commitOption = option.commitOption;
    this.consumerGroupId = option.fetchOption.groupId;
  }

  subscribe(topic: string, consumer: MessageConsumeCallback, fromBeginning: boolean = false): this {
    this.consumeOptions.set(topic, {type: 'simple', consumer, fromBeginning});
    return this;
  }

  subscribeBatched(option: BatchSubscribeOption): this {
    const {topic, ...rest} = option;
    this.consumeOptions.set(topic, {type: 'batch', ...rest});
    return this;
  }

  async wait(): Promise<void> {
    if (!this.startedPromise) {
      throw new Error('The message consumer is not started');
    }
    await this.startedPromise;
    await Promise.race([this.lastBatchConsumed, this.crashPromise]);
  }

  async start(): Promise<void> {
    if (this.startedPromise) {
      return this.startedPromise;
    }
    this.startedPromise = this.performStart();
    return this.startedPromise;
  }

  async stop(): Promise<void> {
    if (this.stoppedPromise) {
      return this.stoppedPromise;
    }
    this.stoppedPromise = new Promise((resolve, reject) => {
      this.workerController.synchronize(async () => {
        setImmediate(() => this.consumer.stop().then(resolve, reject));
        return true;
      });
    }).then(() => this.consumer.disconnect());
    return this.stoppedPromise;
  }

  private async performStart() {
    const topics = Array.from(this.consumeOptions.keys());
    const admin = this.client.admin();
    try {
      await this.consumer.connect();
      for (const [topic, option] of this.consumeOptions) {
        await this.consumer.subscribe({topic, fromBeginning: option.fromBeginning});
      }

      await admin.connect();
      const metadata = await admin.fetchTopicMetadata({topics});

      const totalPartitions = metadata.topics.reduce(
        (result, topicMetadata) => result + topicMetadata.partitions.length,
        0,
      );

      await this.consumer.run({
        autoCommit: true,
        autoCommitInterval: this.commitOption?.commitInterval,
        eachBatchAutoResolve: false,
        partitionsConsumedConcurrently: totalPartitions,
        eachBatch: async (payload) => {
          const promise = this.eachBatch(payload);
          this.lastBatchConsumed = this.lastBatchConsumed.then(() => promise);
          return promise;
        },
      });
    } finally {
      await admin.disconnect();
    }
  }

  private async eachBatch(payload: kafkajs.EachBatchPayload) {
    const {topic, partition} = payload.batch;
    const consumeOption = this.consumeOptions.get(topic);
    if (!consumeOption) {
      throw new Error('Message received from unsubscribed topic');
    } else if (consumeOption.type === 'batch') {
      const {consumer} = consumeOption;
      return consumer(payload);
    }
    const {consumer} = consumeOption;
    const commitOffsets = async (forced: boolean = false) => {
      if (forced) {
        return payload.commitOffsetsIfNecessary(payload.uncommittedOffsets());
      } else {
        return payload.commitOffsetsIfNecessary();
      }
    };

    const heartbeat = async () => {
      try {
        await payload.heartbeat();
      } catch (e: any) {
        if (e.type === 'REBALANCE_IN_PROGRESS' || e.type === 'NOT_COORDINATOR_FOR_GROUP') {
          this.workerController.synchronize(async () => true);
        }
      }
    };

    await this.processBatch(
      async (message: kafkajs.KafkaMessage) => {
        await consumer({topic, partition, ...message});
        payload.resolveOffset(message.offset);
        await payload.commitOffsetsIfNecessary();
      },
      heartbeat,
      (offset: string) => payload.resolveOffset(offset),
      commitOffsets,
      payload.batch.messages,
    );
  }

  private async processBatch(
    consumer: (message: kafkajs.KafkaMessage) => Promise<void>,
    heartbeat: () => Promise<void>,
    resolveOffset: (offset: string) => void,
    commitOffset: (forced?: boolean) => Promise<void>,
    messages: kafkajs.KafkaMessage[],
  ) {
    const synchronizer = this.workerController.createSynchronizer(false);
    try {
      for (const message of messages) {
        await consumer(message);
        await heartbeat();
        resolveOffset(message.offset);
        if (await synchronizer.checkSynchronized(() => commitOffset(true))) {
          return;
        }
        await commitOffset();
      }
    } finally {
      synchronizer.detach();
    }
  }
}
