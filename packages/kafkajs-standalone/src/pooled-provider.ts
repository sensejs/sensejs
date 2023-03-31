import {MessageProducerOption, MessageProducerProvider} from './types.js';
import kafka from 'kafkajs';
import {SimpleKafkaJsMessageProducer} from './simple-message-producer.js';
import {KafkaJsTransactionalMessageProducer} from './transactional-message-producer.js';
import {Pool, PoolConfiguration} from 'lightning-pool';
import {createKafkaClient} from './create-client.js';

export interface PoolOption {
  min?: number;
  max?: number;
  maxWaitingClients?: number;
  idleTimeoutMillis?: number;
}

export interface PooledMessageProducerOption extends MessageProducerOption {
  poolOption?: PoolOption;
}

export class PooledKafkaJsProducerProvider extends MessageProducerProvider {
  #pool: Pool<kafka.Producer> | null = null;
  #client: kafka.Kafka;
  /**
   * This map will store each pool by
   * For Transactional producer, since the transaction id must be unique,
   */
  #txPoolMap: Map<string, Pool<kafka.Producer>> = new Map();
  #txPoolOption: PoolConfiguration;
  #allResourcesDrained = Promise.resolve();

  constructor(private option: PooledMessageProducerOption) {
    super();
    const {poolOption, ...rest} = option;
    this.#client = createKafkaClient(rest);
    const {maxWaitingClients, idleTimeoutMillis} = option.poolOption ?? {};
    this.#txPoolOption = {
      max: 1,
      min: 0,
      minIdle: 1,
      idleTimeoutMillis,
      maxQueue: maxWaitingClients,
    };
    this.#pool = new Pool<kafka.Producer>(
      {
        create: async (): Promise<kafka.Producer> => {
          const producer = this.#client.producer(this.option.producerOption);
          await producer.connect();
          return producer;
        },
        destroy: async (client: kafka.Producer): Promise<void> => {
          await client.disconnect();
        },
        reset: async () => {},
        validate: async () => {},
      },
      poolOption ?? {},
    );
  }

  async createTransactional(transactionalId: string) {
    const pool = this.#ensurePool(transactionalId);
    const producer = await pool.acquire();
    return new KafkaJsTransactionalMessageProducer(this.option.sendOption ?? {}, producer, async () => {
      return pool.releaseAsync(producer);
    });
  }

  async create() {
    const pool = this.#checkReleased();
    const producer = await pool.acquire();
    return new SimpleKafkaJsMessageProducer(this.option.sendOption ?? {}, producer, async (e?: Error | null) => {
      if (e) {
        return pool.destroy(producer);
      } else {
        return pool.release(producer);
      }
    });
  }

  #createTxPool(transactionalId: string) {
    const producer = this.#client.producer({
      ...this.option.producerOption,
      transactionalId,
      maxInFlightRequests: 1,
      idempotent: true,
    });
    const pool = new Pool<kafka.Producer>(
      {
        create: async (): Promise<kafka.Producer> => {
          await producer.connect();
          return producer;
        },
        destroy: async (wrapped): Promise<void> => {
          this.#txPoolMap.delete(transactionalId);
          await producer.disconnect();
          this.#allResourcesDrained = this.#allResourcesDrained.then(() => pool.closeAsync());
        },
        reset: async () => {},
        validate: async () => {},
      },
      this.#txPoolOption,
    );
    this.#txPoolMap.set(transactionalId, pool);
    return pool;
  }

  #ensurePool(transactionalId: string) {
    const pool = this.#txPoolMap.get(transactionalId);
    if (pool) {
      return pool;
    }
    return this.#createTxPool(transactionalId);
  }

  #checkReleased(): Pool<kafka.Producer> {
    if (!this.#pool) {
      throw new Error('Pool has been destroyed');
    }
    return this.#pool;
  }

  async #drainPool() {
    const pool = this.#pool;
    if (!pool) {
      return;
    }
    this.#pool = null;
    await pool.closeAsync(false);
  }

  async #drainTxPool() {
    await Promise.all(Array.from(this.#txPoolMap.values()).map(async (pool) => pool.closeAsync()));
  }

  async destroy() {
    await Promise.all([this.#drainPool(), this.#drainTxPool()]);
  }
}
