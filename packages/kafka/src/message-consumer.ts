import {
  ConnectOption,
  ConsumeManagerOption,
  ConsumeOption,
  FetchOption,
  MessageConsumeManager,
} from './message-consume-manager';
import {MessageConsumer as ConsumeCallback} from 'kafka-pipeline';

export interface ConsumeTopicOption extends FetchOption, ConsumeOption {
  topic: string;
  consumeCallback: ConsumeCallback;
}

export class MessageConsumer {
  private readonly _options: ConnectOption;
  private _topicOptions: Map<string, ConsumeManagerOption> = new Map();
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

  subscribe(option: ConsumeTopicOption) {
    const {topic} = option;
    if (this._topicOptions.get(topic)) {
      throw new Error(`Topic "${topic}" has already been subscribed`);
    }
    this._topicOptions.set(topic, Object.assign({}, this._options, option));
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
