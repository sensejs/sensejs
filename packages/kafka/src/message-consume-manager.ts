'use strict';

import {ConsumerGroupPipeline, MessageConsumer as ConsumeCallback} from 'kafka-pipeline';

export interface ConsumeOption {
  consumeConcurrency?: number;
  consumeTimeout?: number;
  commitInterval?: number;
}

export interface FetchOption {
  encoding?: 'utf8' | 'buffer';
  keyEncoding?: 'utf8' | 'buffer';
  fromOffset?: 'latest' | 'earliest' | 'none';
  outOfRangeOffset?: 'earliest' | 'latest' | 'none';
  fetchMinBytes?: number;
  fetchMaxBytes?: number;
}

export interface ConnectOption {
  kafkaHost: string;
  groupId: string;
  sessionTimeout?: number;
  heartbeatInterval?: number;
}

export interface ConsumeManagerOption extends ConnectOption, ConsumeOption, FetchOption {
  topic: string;
  consumeCallback: ConsumeCallback;
}

export class MessageConsumeManager {
  private _openPromise?: Promise<unknown>;
  private _runningPromise?: Promise<unknown>;
  private _consumerGroupPipeline: ConsumerGroupPipeline;

  constructor(options: ConsumeManagerOption) {
    const {topic, consumeCallback, consumeConcurrency, consumeTimeout, commitInterval, ...rest} = options;
    const pipelineOption: ConsumerGroupPipeline.Option = {
      topic,
      messageConsumer: consumeCallback,
      consumerGroupOption: rest,
    };

    if (consumeConcurrency) {
      pipelineOption.consumeConcurrency = consumeConcurrency;
    }

    if (consumeTimeout) {
      pipelineOption.consumeTimeout = consumeTimeout;
    }

    if (commitInterval) {
      pipelineOption.commitInterval = commitInterval;
    }

    this._consumerGroupPipeline = new ConsumerGroupPipeline(pipelineOption);
  }

  async open() {
    if (this._openPromise) {
      return this._openPromise;
    }
    this._openPromise = this._consumerGroupPipeline.start();
    this._runningPromise = this._consumerGroupPipeline.wait();
    return this._openPromise;
  }

  /**
   * Stop consuming
   * @returns {Promise}
   */
  close() {
    if (this._runningPromise) {
      delete this._runningPromise;
    }
    return this._consumerGroupPipeline.close();
  }
}
