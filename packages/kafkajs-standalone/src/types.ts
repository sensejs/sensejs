import k from 'kafkajs';
import {LogEntry, logLevel, Message, Offsets, RecordMetadata, TopicMessages} from 'kafkajs';
import {KafkaLogAdapterOption} from './logging.js';
import {Logger} from '@sensejs/utility';

export interface KafkaConnectOption extends Omit<k.KafkaConfig, 'logLevel' | 'logCreator' | 'brokers'> {
  brokers: string | string[];
}

export type KafkaProduceOption = Omit<k.ProducerConfig, 'transactionalId'>;

export interface SimpleMessageProducer {
  /**
   * Send single message
   * @param topic
   * @param messages
   */
  sendMessage(topic: string, messages: Message): Promise<RecordMetadata>;

  /**
   * Send multiple messages to different topic
   */
  sendMessageBatch(
    ...args: [topic: string, messages: Message[]] | [topicMessages: TopicMessages[]]
  ): Promise<RecordMetadata[]>;

  /**
   * Send multiple messages to a single topic
   * @param topic
   * @param messages
   */
  sendMessageBatch(topic: string, messages: Message[]): Promise<RecordMetadata[]>;

  /**
   * Send multiple messages to different topic
   * @param topicMessages
   */
  sendMessageBatch(topicMessages: TopicMessages[]): Promise<RecordMetadata[]>;

  /**
   * Release this message producer, it will be returned to the pool or disconnected
   *
   */
  release(): Promise<void>;

  isActive(): boolean;
}

export interface TransactionalMessageProducer extends SimpleMessageProducer {
  /**
   * Commit kafka consumer offset within this transaction
   * @param consumerGroupId
   * @param offsets
   */
  sendOffset(consumerGroupId: string, offsets: Offsets): Promise<void>;

  /**
   * Commit this kafka transaction
   *
   * @note An error will be thrown when producer has already released
   */
  commit(): Promise<void>;

  /**
   * Abort this kafka transaction
   *
   * @note An error will be thrown when producer has already released
   */
  abort(): Promise<void>;
}

export type KafkaCompressionType = k.CompressionTypes;

export interface KafkaSendOption {
  acks?: number;
  timeout?: number;
  compression?: KafkaCompressionType;
}

export type KafkaBatchMessage = k.Batch;
export type KafkaBatchConsumeMessageParam = k.EachBatchPayload;
export type KafkaMessage = k.Message;

export interface KafkaReceivedMessage extends KafkaMessage {
  topic: string;
  partition: number;
  offset: string;
}

export interface KafkaLogOption {
  level?: logLevel;
  logCreator?: (level: number) => (logEntry: LogEntry) => void;
}

export interface KafkaClientOption {
  connectOption: KafkaConnectOption;
  logOption?: KafkaLogAdapterOption;
  logger?: Logger;
}

export abstract class MessageProducerProvider {
  abstract create(): Promise<SimpleMessageProducer>;
  abstract createTransactional(transactionalId: string): Promise<TransactionalMessageProducer>;
  abstract destroy(): Promise<void>;
}

export interface MessageProducerOption extends KafkaClientOption {
  producerOption?: KafkaProduceOption;
  sendOption?: KafkaSendOption;
}
