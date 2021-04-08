import {Consumer, ConsumerConfig, EachBatchPayload, Kafka, KafkaMessage as KafkaJsMessage, RetryOptions} from 'kafkajs';
import {WorkerController} from './worker-synchronizer';
import {createKafkaClient} from './create-client';
import {KafkaClientOption, KafkaReceivedMessage} from './types';

export interface KafkaFetchOption extends Exclude<ConsumerConfig, 'retry'> {
  retry?: RetryOptions;
}

export interface KafkaCommitOption {
  commitInterval: number;
}

export interface MessageConsumerOption extends KafkaClientOption {
  fetchOption: KafkaFetchOption;
  commitOption?: KafkaCommitOption;
  onCrash?: (e?: Error) => Promise<boolean>;
}

export interface MessageConsumeCallback {
  (message: KafkaReceivedMessage): Promise<void>;
}

interface ConsumeOption {
  consumer: MessageConsumeCallback;
  fromBeginning: boolean;
}

export class MessageConsumer {
  private client: Kafka;
  private consumer: Consumer;
  private consumeOptions: Map<string, ConsumeOption> = new Map();
  private crashPromise?: Promise<void>;
  private runPromise?: Promise<unknown>;
  private workerController = new WorkerController<boolean>();
  private startedPromise?: Promise<void>;
  private stoppedPromise?: Promise<void>;

  constructor(private option: MessageConsumerOption) {
    this.client = createKafkaClient(option);
    this.consumer = this.client.consumer(option.fetchOption);
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
  }

  subscribe(topic: string, consumer: MessageConsumeCallback, fromBeginning: boolean = false): this {
    this.consumeOptions.set(topic, {consumer, fromBeginning});
    return this;
  }

  async wait(): Promise<void> {
    if (!this.runPromise) {
      throw new Error('The message consumer is not started');
    }
    await Promise.race([this.runPromise, this.crashPromise]);
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

      this.runPromise = this.consumer.run({
        autoCommit: true,
        autoCommitInterval: this.option.commitOption?.commitInterval,
        eachBatchAutoResolve: false,
        partitionsConsumedConcurrently: totalPartitions,
        eachBatch: async (payload) => this.eachBatch(payload),
      });
    } finally {
      await admin.disconnect();
    }
  }

  private async eachBatch(payload: EachBatchPayload) {
    const {topic, partition} = payload.batch;
    const consumeOption = this.consumeOptions.get(topic);
    if (!consumeOption) {
      throw new Error('Message received from unsubscribed topic');
    }
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
      } catch (e) {
        if (e.type === 'REBALANCE_IN_PROGRESS' || e.type === 'NOT_COORDINATOR_FOR_GROUP') {
          this.workerController.synchronize(async () => true);
        }
      }
    };

    await this.processBatch(
      async (message: KafkaJsMessage) => {
        await consumeOption.consumer({topic, partition, ...message});
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
    consumer: (message: KafkaJsMessage) => Promise<void>,
    heartbeat: () => Promise<void>,
    resolveOffset: (offset: string) => void,
    commitOffset: (forced?: boolean) => Promise<void>,
    messages: KafkaJsMessage[],
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
