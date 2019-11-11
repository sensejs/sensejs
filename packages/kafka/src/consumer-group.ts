import {MessageConsumer} from 'kafka-pipeline';
import {ConnectOption, ConsumeOption, FetchOption, TopicSubscriber, TopicSubscriberOption} from './topic-subscriber';

export class ConsumerGroup {
  private readonly _options: ConnectOption;
  private _topicOptions: Map<string, TopicSubscriberOption> = new Map();
  private _consumers: TopicSubscriber[] = [];
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
    messageConsumer: MessageConsumer,
    consumeOption: ConsumeOption = {},
    fetchOption: FetchOption = {},
  ) {
    this._topicOptions.set(topic, {
      topic,
      messageConsumer,
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
      this._consumers.push(new TopicSubscriber(option));
    }
    return Promise.all(
      this._consumers.map((consumer) => {
        return consumer.open();
      }),
    );
  }
}
