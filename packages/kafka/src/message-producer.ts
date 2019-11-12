import {CustomPartitioner, HighLevelProducer, KafkaClient, ProduceRequest, ProducerOptions} from 'kafka-node';
import {Writable} from 'stream';

export interface ProducerOption {
  kafkaHost: string;
  producerOptions?: ProducerOptions;
  customPartition?: CustomPartitioner;
  maxMessageSize?: number;
  maxMessageBatchSize?: number;
}

type MessageContent = string | Buffer;

export class MessageProducer {
  private readonly _option: ProducerOption;
  private readonly _maxMessageSize: number;
  private readonly _maxMessageBatchSize: number;
  private _initialized?: Promise<Writable>;
  private _highLevelProducer?: HighLevelProducer;

  /**
   * Constructor
   * @param option
   * @param option.kafkaHost {String}
   * @param [option.producerOptions]
   */
  constructor(option: ProducerOption) {
    this._option = option;
    this._maxMessageSize = option.maxMessageSize || 65536;
    this._maxMessageBatchSize = option.maxMessageBatchSize || 16;
  }

  /**
   *
   * @param topic Topic to which the message will be publish
   * @param messages
   * @param key
   * @returns {Promise}
   */
  async produceMessage(topic: string, messages: MessageContent, key?: MessageContent) {
    if (!this._initialized) {
      throw new Error('not connected or closed');
    }
    const stream = await this._initialized;
    const chunk: ProduceRequest = {
      topic,
      messages,
      key,
    };
    return new Promise((resolve, reject) => stream.write(chunk, (e) => (e ? reject(e) : resolve())));
  }

  async close() {
    const initialized = this._initialized;
    delete this._initialized;
    if (!initialized) {
      return;
    }

    return initialized
      .then((writable) => {
        return new Promise((resolve, reject) => {
          writable.once('error', reject);
          writable.end(() => resolve(writable));
        });
      })
      .then(() => {
        const highLevelProducer = this._highLevelProducer;
        delete this._highLevelProducer;
        if (highLevelProducer) {
          return new Promise((resolve, reject) => highLevelProducer.close((e?) => (e ? reject(e) : resolve())));
        }
      });
  }

  public async initialize() {
    await this._doInitialize();
    return this;
  }

  private _doInitialize() {
    if (this._initialized) {
      return this._initialized;
    }
    return (this._initialized = new Promise<HighLevelProducer>((done, fail) => {
      const client = new KafkaClient({kafkaHost: this._option.kafkaHost});

      const producer = new HighLevelProducer(
        client,
        Object.assign({requireAcks: 1, ackTimeoutMs: 1000}, this._option.producerOptions),
        this._option.customPartition,
      );

      const errorBeforeReady = (error: Error) => {
        return client.close(() => fail(error));
      };

      producer.once('error', errorBeforeReady);
      producer.once('ready', () => {
        producer.removeListener('error', errorBeforeReady);
        done(producer);
      });
    }).then((highLevelProducer: HighLevelProducer) => {
      this._highLevelProducer = highLevelProducer;
      return new Writable({
        objectMode: true,
        decodeStrings: false,
        highWaterMark: 16,
        write: (chunk: ProduceRequest, encoding, callback) => {
          highLevelProducer.send([chunk], callback);
        },
        writev: (chunks: {chunk: ProduceRequest}[], callback) => {
          highLevelProducer.send(chunks.map((x) => x.chunk), callback);
        },
      });
    }));
  }
}
