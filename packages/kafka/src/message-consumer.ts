import {MessageConsumer as MessageConsumeCallback} from 'kafka-pipeline';
import {
  ConnectOption,
  ConsumeOption,
  FetchOption,
  MessageConsumeManager,
  TopicConsumerOption,
} from './message-consume-manager';

export class MessageConsumer {
  private readonly _options: ConnectOption;
  private _topicOptions: Map<string, TopicConsumerOption> = new Map();
  private _consumers: MessageConsumeManager[] = [];
  private _openPromise?: Promise<unknown>;
  private _listenPromise?: Promise<unknown>;

  /**
   * @param options.groupId
   * @param [options.zookeeperUri]
   * @param [options.kafkaHost]
   */
  constructor(options: ConnectOption) {
    this._options = options;
  }

  /**
   *
   * @param topic
   * @param consumeOption
   * @param fetchOption
   *
   * @returns this
   */
  subscribe(
    topic: string,
    messageConsumeCallback: MessageConsumeCallback,
    consumeOption: ConsumeOption = {},
    fetchOption: FetchOption = {},
  ) {
    this._topicOptions.set(topic, {
      topic,
      consumeCallback: messageConsumeCallback,
      consumeOption,
      connectOption: this._options,
      fetchOption,
    });
    return this;
  }

  async open() {
    if (this._openPromise) {
      return this._openPromise;
    }
    this._openPromise = this._performOpen();
    return this._openPromise;
  }

  async close() {
    await Promise.all([this._listenPromise].concat(this._consumers.map((consumer) => consumer.close())));
    this._consumers.splice(0);
  }

  private _performOpen() {
    for (const option of this._topicOptions.values()) {
      this._consumers.push(new MessageConsumeManager(option));
    }
    return Promise.all(
      this._consumers.map((consumer) => {
        return consumer.open();
      }),
    );
  }
}
