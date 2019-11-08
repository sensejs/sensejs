import {MessageConsumer} from 'kafka-pipeline';
import {ConnectOption, ConsumeOption, FetchOption, TopicSubscriber, TopicSubscriberOption} from './topic-subscriber';

export class ConsumerGroup {
  private readonly _options: ConnectOption;
  private _topicOptions: Map<string, TopicSubscriberOption> = new Map();
  private _consumers: TopicSubscriber[] = [];
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

  /**
   *
   * @returns {Promise}
   */
  listen() {
    if (this._listenPromise) {
      return this._listenPromise;
    }
    this._listenPromise = this._performListen();
    return this._listenPromise;
  }

  async close() {
    if (this._listenPromise === null) {
      return;
    }
    await Promise.all(this._consumers.map((consumer) => consumer.close()));
    this._consumers.splice(0);
  }

  private _performListen() {
    for (const option of this._topicOptions.values()) {
      this._consumers.push(new TopicSubscriber(option));
    }
    return Promise.all(this._consumers.map((consumer) => consumer.listen()));
  }
}
