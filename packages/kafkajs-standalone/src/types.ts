import * as k from 'kafkajs';

export interface KafkaConnectOption extends Omit<k.KafkaConfig, 'logLevel' | 'logCreator' | 'brokers'> {
  brokers: string | string[];
}

export interface MessageKeyProvider {
  (value: Buffer | string | null, topic: string): Buffer | string | null;
}

export interface KafkaProducerOption extends k.ProducerConfig {
  messageKeyProvider?: MessageKeyProvider;
}

export interface KafkaSendOption {
  acks?: number;
  timeout?: number;
  compression?: k.CompressionTypes;
}

export type KafkaMessage = k.Message;

export interface KafkaReceivedMessage extends KafkaMessage {
  topic: string;
  partition: number;
  offset: string;
}
