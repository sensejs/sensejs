import * as k from 'kafkajs';

export interface KafkaConnectOption extends Omit<k.KafkaConfig, 'logLevel' | 'logCreator'> {

}

export interface KafkaProducerOption extends Omit<k.ProducerConfig, 'createPartitioner'> {

}

export interface KafkaSendOption {
  acks?: number;
  timeout?: number;
  compression?: k.CompressionTypes;
}

export type KafkaMessage = k.Message;
