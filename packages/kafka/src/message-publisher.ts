import {CustomPartitioner, HighLevelProducer, KafkaClient, ProduceRequest, ProducerOptions} from 'kafka-node';
import {promisify} from 'util';

export interface ProducerOption {
  kafkaHost: string;
  producerOptions?: ProducerOptions;
  customPartition?: CustomPartitioner;
  maxMessageSize?: number;
  maxMessageBatchSize?: number;
}

type MessageContent = string | Buffer;

interface SendRequest {
  topic: string;
  messages: MessageContent;
  done: (e?: Error) => unknown;
  key?: MessageContent;
}

export class Producer {

  private readonly _createTopics: string[];
  private readonly _option: ProducerOption;
  private readonly _maxMessageSize: number;
  private readonly _maxMessageBatchSize: number;
  private readonly _bufferedMessages: SendRequest[];
  private _sendMessagePromise?: Promise<unknown>;
  private _initialized?: Promise<HighLevelProducer>;
  private _refreshMetadataPromise?: Promise<HighLevelProducer>;
  private _heartBeatTimer?: NodeJS.Timer;

  /**
   * Constructor
   * @param option
   * @param option.kafkaHost {String}
   * @param [option.producerOptions]
   * @param createTopics {String | Array<String>}
   */
  constructor(option: ProducerOption, createTopics: string | string[] = []) {

    if (typeof createTopics === 'string') {
      if (createTopics === '') {
        throw new TypeError('param "createTopics" should not be a empty string.');
      }
      this._createTopics = [createTopics];
    } else if (!Array.isArray(createTopics)) {
      throw new TypeError('param "createTopics" should be a non-empty string or an array of non-empty string');
    } else if (createTopics.filter((topic) =>  topic !== '').length > 0) {
      throw new TypeError('array param "createTopics" contains element of non-string object or empty string');
    } else {
      this._createTopics = createTopics;
    }

    this._option = option;
    this._maxMessageSize = option.maxMessageSize || 65536;
    this._maxMessageBatchSize = option.maxMessageBatchSize || 16;
    this._bufferedMessages = [];
  }

  async initialize(): Promise<this> {
    if (!this._initialized) {
      this._initialized = this._doInitialization();
    }
    await this._initialized;
    return this;
  }

  /**
   *
   * @param topic Topic to which the message will be publish
   * @param messages
   * @param key
   * @returns {Promise}
   */
  async sendMessage(topic: string, messages: MessageContent, key?: MessageContent) {
    await this.initialize();
    this._checkMessageSize(messages);
    return this._internalSendMessage(topic, messages, key);
  }

  async close() {
    if (!this._initialized) {
      return;
    }
    const producer = await this._initialized;
    this._clearRefreshMetadataTimer();
    if (producer) {
      // @ts-ignore
      return Bluebird.fromCallback((callback) => producer.close(callback));
    }
  }

  /**
   * Initialize the producer
   * @returns {Promise<HighLevelProducer>}
   * @private
   */
  private _doInitialization() {
    this._initialized = new Promise<HighLevelProducer>((done, fail) => {
      const client = new KafkaClient({kafkaHost: this._option.kafkaHost});

      const producer = new HighLevelProducer(client,
        Object.assign({requireAcks: 1, ackTimeoutMs: 1000}, this._option.producerOptions),
        this._option.customPartition);

      const errorBeforeReady = (error: Error) => {
        return client.close(() => fail(error));
      };

      producer.once('error', errorBeforeReady);
      producer.once('ready', () => {
        producer.removeListener('error', errorBeforeReady);
        producer.createTopics(this._createTopics, true, (e) => {
          if (e) {
            return fail(e);
          }
          return done(producer);
        });
      });
    });
    this._initialized.then((producer) => {
      // @ts-ignore
      const refreshMetadataInterval = producer?.client?.options.idleConnection;
      if (typeof refreshMetadataInterval === 'number' && refreshMetadataInterval === 0) {
        this._heartBeatTimer = setInterval(async () => {
          // @ts-ignore send empty metadata request to keep connection alive, do it only when no
          producer.client.loadMetadataForTopics([], (e) => {
          });
        }, refreshMetadataInterval / 2);
      }
    });
    return this._initialized;
  }

  private _clearRefreshMetadataTimer() {
    if (this._heartBeatTimer) {
      clearInterval(this._heartBeatTimer);
      delete this._heartBeatTimer;
    }
  }

  private _refreshMetadata() {
    if (this._refreshMetadataPromise) {
      return this._refreshMetadataPromise;
    }
    this._refreshMetadataPromise = this._doInitialization()
      .then((producer) => {
        return promisify((callback) => {
          // @ts-ignore
          return producer.client.refreshMetadata(this._createTopics, callback);
        })()
          .then(() => {
            // @ts-ignore
            producer.client.once('brokersChanged', () => {
              delete this._refreshMetadataPromise;
            });
            return producer;
          });
      });
    return this._refreshMetadataPromise;
  }

  private async _sendBufferedMessage(bufferedMessages: SendRequest[]) {
    let error: Error;
    try {
      const producer = await this._refreshMetadata();
      await (promisify((callback) => {
        return producer.send(bufferedMessages.map(({topic, key, messages}): ProduceRequest => {
          return {topic, key, messages};
        }), callback);
      })());
    } catch (e) {
      error = e;
    } finally {
      bufferedMessages.forEach(({done}) => done(error));
    }
  }

  private async _sendBufferedMessageUntilEmpty() {
    try {
      while (this._bufferedMessages.length > 0) {
        const batchMessage = this._bufferedMessages.splice(0, this._maxMessageBatchSize);
        this._sendMessagePromise = this._sendBufferedMessage(batchMessage);
        await this._sendMessagePromise;
      }
    } finally {
      delete this._sendMessagePromise;
    }
  }

  private _checkMessageSize(messages: MessageContent): void {
    if (typeof messages === 'string') {
      messages = Buffer.from(messages, 'utf-8');
    }
    if (messages.length >= this._maxMessageSize) {
      throw new Error(`Message size exceeded limit of ${this._maxMessageSize}`);
    }
  }

  private _internalSendMessage(topic: string,
                               messages: MessageContent,
                               key?: MessageContent) {
    const sendPromise = new Promise<void>((resolve, reject) => {
      this._bufferedMessages.push({
        topic, messages, key, done: (e?) => {
          if (e) {
            return reject(e);
          }
          return resolve();
        }
      });
    });

    if (!this._sendMessagePromise) {
      this._sendBufferedMessageUntilEmpty();
    }

    return sendPromise;
  }
}
