'use strict';

import {ConsumerGroupPipeline, MessageConsumer} from 'kafka-pipeline';

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

export interface TopicSubscriberOption {
  connectOption: ConnectOption;
  consumeOption?: ConsumeOption;
  fetchOption?: FetchOption;
  topic: string;
  messageConsumer: MessageConsumer;
}

export class TopicSubscriber {
  _listenPromise?: Promise<unknown>;
  _consumerGroupPipeline: ConsumerGroupPipeline;

  constructor(options: TopicSubscriberOption) {
    const {
      topic,
      messageConsumer,
      connectOption: {groupId, kafkaHost, sessionTimeout, heartbeatInterval},
      consumeOption,
      fetchOption: {
        encoding,
        keyEncoding,
        fromOffset,
        outOfRangeOffset,
        fetchMaxBytes,
        fetchMinBytes,
      } = {} as FetchOption,
    } = options;

    const pipelineOption: ConsumerGroupPipeline.Option = Object.assign({}, consumeOption, {
      topic,
      messageConsumer,
      consumerGroupOption: {
        encoding,
        keyEncoding,
        kafkaHost,
        groupId,
        fromOffset,
        outOfRangeOffset,
        fetchMaxBytes,
        fetchMinBytes,
        sessionTimeout,
        heartbeatInterval,
      },
    });
    this._consumerGroupPipeline = new ConsumerGroupPipeline(pipelineOption);
  }

  /**
   * Start consuming
   * @returns {Promise}
   */
  async listen() {
    if (this._listenPromise) {
      return;
    }
    const startedPromise = this._consumerGroupPipeline.start();
    this._listenPromise = this._consumerGroupPipeline.wait();
    return startedPromise.then(() => this._listenPromise);
  }

  /**
   * Stop consuming
   * @returns {Promise}
   */
  close() {
    if (!this._listenPromise) {
      return;
    }
    delete this._listenPromise;
    return this._consumerGroupPipeline.close();
  }
}
