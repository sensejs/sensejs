import {
  Abstract,
  Component,
  Constructor,
  RequestInterceptor,
  validateFunctionParamBindingMetadata,
} from '@sensejs/core';

export interface SubscribeTopicMetadata {
  topic: string;
  interceptors: Constructor<RequestInterceptor>[];
  consumeConcurrency?: number;
  consumeTimeout?: number;
}

export interface SubscribeTopicOption {
  interceptors?: Constructor<RequestInterceptor>[];
  consumeConcurrency?: number;
  consumeTimeout?: number;
}

export interface SubscribeControllerMetadata {
  interceptors: Constructor<RequestInterceptor>[];
  target: Constructor<{}> | Abstract<{}>;
}

export interface SubscribeControllerOption {
  interceptors?: Constructor<RequestInterceptor>[];
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

export function SubscribeTopic(topic: string, option: SubscribeTopicOption = {}) {
  return <T extends {}>(prototype: T, method: keyof T & string) => {
    const targetMethod = prototype[method];
    if (typeof targetMethod !== 'function') {
      throw new Error('Request mapping decorator must be applied to a function');
    }
    validateFunctionParamBindingMetadata(targetMethod);
    const metadata: SubscribeTopicMetadata = Object.assign({interceptors: []}, option, {topic});
    setSubscribeTopicMetadata(targetMethod, metadata);
  };
}

export function SubscribeController(option: SubscribeControllerOption = {}) {
  return (constructor: Constructor<{}>) => {
    const metadata: SubscribeControllerMetadata = Object.assign({target: constructor, interceptors: []}, option);
    setSubscribeControllerMetadata(constructor, metadata);
    Component()(constructor);
  };
}
