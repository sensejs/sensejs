import {Component, Constructor, RequestInterceptor, ServiceIdentifier} from '@sensejs/core';

export interface SubscribeTopicMetadata {
  fallbackOption?: SubscribeTopicOption;
  interceptors: Constructor<RequestInterceptor>[];
  injectOptionFrom?: ServiceIdentifier<SubscribeTopicOption>;
}

export interface SubscribeTopicOption {
  topic?: string;
  fromBeginning?: boolean;
}

export interface SubscribeControllerMetadata<T = any> {
  interceptors: Constructor<RequestInterceptor>[];
  target: Constructor<T>;
  labels: Set<string | symbol>;
}

export interface SubscribeControllerOption {
  interceptors?: Constructor<RequestInterceptor>[];
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

interface InjectedSubscribeTopicDecoratorOption {
  option?: SubscribeTopicOption;
  injectOptionFrom?: ServiceIdentifier<SubscribeTopicOption>;
  interceptors?: Constructor<RequestInterceptor>[];
}

export function SubscribeTopic(option: InjectedSubscribeTopicDecoratorOption) {
  return <T extends {}>(prototype: T, method: keyof T & string) => {
    const targetMethod = prototype[method];
    if (typeof targetMethod !== 'function') {
      throw new Error('Request mapping decorator must be applied to a function');
    }
    const {option: fallbackOption, injectOptionFrom, interceptors = []} = option;
    const metadata: SubscribeTopicMetadata = {
      fallbackOption,
      interceptors,
      injectOptionFrom,
    };
    setSubscribeTopicMetadata(targetMethod, metadata);
  };
}

export function SubscribeController(option: SubscribeControllerOption = {}) {
  return (constructor: Constructor<{}>) => {
    const {interceptors = [], labels} = option;
    const metadata: SubscribeControllerMetadata = {
      target: constructor,
      interceptors,
      labels: new Set(labels),
    };
    setSubscribeControllerMetadata(constructor, metadata);
    Component()(constructor);
  };
}
