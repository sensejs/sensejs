import {AsyncInterceptProvider} from '@sensejs/container';
import {Component, Constructor, ServiceIdentifier} from '@sensejs/core';

export interface BatchedSubscribeTopicMetadata {
  type: 'batched';
  fallbackOption?: SubscribeTopicOption;
  interceptProviders: Constructor<AsyncInterceptProvider>[];
  injectOptionFrom?: ServiceIdentifier<SubscribeTopicOption>;
}

export interface SimpleSubscribeTopicMetadata {
  type: 'simple';
  fallbackOption?: SubscribeTopicOption;
  interceptProviders: Constructor<AsyncInterceptProvider>[];
  injectOptionFrom?: ServiceIdentifier<SubscribeTopicOption>;
}

export type SubscribeTopicMetadata = SimpleSubscribeTopicMetadata | BatchedSubscribeTopicMetadata;

export interface SubscribeTopicOption {
  topic?: string;
  fromBeginning?: boolean;
}

export interface SubscribeControllerMetadata<T = any> {
  interceptProviders: Constructor<AsyncInterceptProvider>[];
  target: Constructor<T>;
  labels: Set<string | symbol>;
}

export interface SubscribeControllerOption {
  interceptProviders?: Constructor<AsyncInterceptProvider>[];
  labels?: (string | symbol)[] | Set<string | symbol>;
}

const SUBSCRIBE_TOPIC_METADATA_KEY = Symbol();
const SUBSCRIBE_CONTROLLER_METADATA_KEY = Symbol();

function setSubscribeTopicMetadata(fn: Function, metadata: SubscribeTopicMetadata) {
  if (Reflect.getMetadata(SUBSCRIBE_TOPIC_METADATA_KEY, fn)) {
    throw new Error('@SubscribeTopic() already decorated on this function');
  }
  Reflect.defineMetadata(SUBSCRIBE_TOPIC_METADATA_KEY, metadata, fn);
}

export function getSubscribeTopicMetadata(fn: Function): SubscribeTopicMetadata | undefined {
  return Reflect.getMetadata(SUBSCRIBE_TOPIC_METADATA_KEY, fn);
}

function setSubscribeControllerMetadata(constructor: Constructor<{}>, metadata: SubscribeControllerMetadata) {
  if (Reflect.getMetadata(SUBSCRIBE_CONTROLLER_METADATA_KEY, constructor)) {
    throw new Error('@SubscribeController() already decorated on this class');
  }
  Reflect.defineMetadata(SUBSCRIBE_CONTROLLER_METADATA_KEY, metadata, constructor);
}

export function getSubscribeControllerMetadata(constructor: {}): SubscribeControllerMetadata | undefined {
  return Reflect.getMetadata(SUBSCRIBE_CONTROLLER_METADATA_KEY, constructor);
}

export interface SimpleSubscribeTopicDecoratorOption {
  option?: SubscribeTopicOption;
  injectOptionFrom?: ServiceIdentifier<SubscribeTopicOption>;
  interceptProviders?: Constructor<AsyncInterceptProvider>[];
}
export interface BatchedSubscribeTopicDecoratorOption {
  option?: SubscribeTopicOption;
  injectOptionFrom?: ServiceIdentifier<SubscribeTopicOption>;
  interceptProviders?: Constructor<AsyncInterceptProvider>[];
}

export function SubscribeTopic(option: SimpleSubscribeTopicDecoratorOption) {
  return <T extends {}>(prototype: T, method: keyof T): void => {
    const targetMethod = prototype[method];
    if (typeof targetMethod !== 'function') {
      throw new Error('Request mapping decorator must be applied to a function');
    }
    const {option: fallbackOption, injectOptionFrom, interceptProviders = []} = option;
    const metadata: SimpleSubscribeTopicMetadata = {
      type: 'simple',
      fallbackOption,
      interceptProviders,
      injectOptionFrom,
    };
    setSubscribeTopicMetadata(targetMethod, metadata);
  };
}

export function BatchedSubscribeTopic(option: BatchedSubscribeTopicDecoratorOption) {
  return <T extends {}>(prototype: T, method: keyof T): void => {
    const targetMethod = prototype[method];
    if (typeof targetMethod !== 'function') {
      throw new Error('Request mapping decorator must be applied to a function');
    }
    const {option: fallbackOption, injectOptionFrom, interceptProviders = []} = option;
    const metadata: BatchedSubscribeTopicMetadata = {
      type: 'batched',
      fallbackOption,
      interceptProviders,
      injectOptionFrom,
    };
    setSubscribeTopicMetadata(targetMethod, metadata);
  };
}

export function SubscribeController(option: SubscribeControllerOption = {}) {
  return (constructor: Constructor<{}>): void => {
    const {interceptProviders = [], labels} = option;
    const metadata: SubscribeControllerMetadata = {
      target: constructor,
      interceptProviders,
      labels: new Set(labels),
    };
    setSubscribeControllerMetadata(constructor, metadata);
    Component()(constructor);
  };
}
