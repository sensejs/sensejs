import {Constructor} from '@sensejs/utility';
import {
  composeRequestInterceptor,
  Inject,
  invokeMethod,
  ModuleClass,
  ModuleOption,
  OnModuleCreate,
  OnModuleDestroy,
  RequestContext,
  RequestInterceptor,
  ServiceIdentifier,
} from '@sensejs/core';
import {Container} from 'inversify';
import {ensureEventChannel} from './event-channels';
import {EventListener} from './types';

const EVENT_SUBSCRIPTION_KEY = Symbol();

export interface EventSubscriptionMetadata<P extends {} = {}> {
  prototype: P;
  name: keyof P & (string | symbol);
  channel: unknown;
  interceptors: Constructor<RequestInterceptor>[];
}

export interface EventSubscriptionOption {
  interceptors?: Constructor<RequestInterceptor>[];
}

/**
 *
 * @decorator
 */
export function EventSubscription(channel: unknown, option: EventSubscriptionOption = {}) {
  return <P extends {}>(prototype: P, name: keyof P & (string | symbol)) => {
    const metadata: EventSubscriptionMetadata<P> = {
      prototype,
      name,
      channel,
      interceptors: option.interceptors ?? [],
    };
    Reflect.defineMetadata(EVENT_SUBSCRIPTION_KEY, metadata, prototype[name]);
  };
}

function getEventSubscriptionMetadata<P extends {} = {}>(target: Function): EventSubscriptionMetadata<P> | undefined {
  return Reflect.getMetadata(EVENT_SUBSCRIPTION_KEY, target);
}

export interface EventSubscriptionModuleOption extends ModuleOption {
  interceptors?: Constructor<RequestInterceptor>[];
}

export class EventSubscriptionContext<Payload> extends RequestContext {
  constructor(private container: Container, public readonly payload: Payload) {
    super();
    container.bind(EventSubscriptionContext).toConstantValue(this);
  }

  bindContextValue<T>(key: ServiceIdentifier<T>, value: T): void {
    this.container.bind(key).toConstantValue(value);
  }
}

/**
 *
 * @decorator
 */
export function EventSubscriptionModule(option: EventSubscriptionModuleOption = {}) {

  return (constructor: Constructor) => {

    const metadataList = Object.values(Object.getOwnPropertyDescriptors(constructor.prototype))
      .map((pd) => pd.value)
      .filter((value) => typeof value === 'function')
      .map(getEventSubscriptionMetadata)
      .filter((value): value is EventSubscriptionMetadata => typeof value !== 'undefined');

    const listeners: EventListener[] = [];

    async function onModuleCreate(this: object, container: Container) {
      metadataList.forEach((metadata) => {
        const interceptors = [
          ...option.interceptors ?? [],
          ...metadata.interceptors,
        ];
        const composedInterceptorConstructor = composeRequestInterceptor(container, interceptors);
        listeners.push(ensureEventChannel(metadata.channel).receiver.listen(async (payload) => {
          const childContainer = container.createChild();
          const context = new EventSubscriptionContext(childContainer, payload);
          const composedInterceptor = childContainer.get(composedInterceptorConstructor);

          return composedInterceptor.intercept(context, () => {
            return Promise.resolve(invokeMethod(childContainer, this, metadata.prototype[metadata.name]));
          });
        }));
      });
    }

    async function onModuleDestroy(this: object, container: Container) {
      listeners.forEach((listener) => listener.close());
    }

    const onModuleCreateSymbol = Symbol() as keyof {}, onModuleDestroySymbol = Symbol() as keyof {};

    Reflect.defineProperty(
      constructor.prototype,
      onModuleCreateSymbol,
      {value: onModuleCreate, configurable: false, enumerable: false, writable: false},
    );
    Reflect.defineProperty(
      constructor.prototype,
      onModuleDestroySymbol,
      {value: onModuleDestroy, configurable: false, enumerable: false, writable: false},
    );

    Inject(Container)(constructor.prototype, onModuleCreateSymbol, 0);
    Inject(Container)(constructor.prototype, onModuleDestroySymbol, 0);
    OnModuleCreate()(constructor.prototype, onModuleCreateSymbol, {value: onModuleCreate});
    OnModuleDestroy()(constructor.prototype, onModuleDestroySymbol, {value: onModuleDestroy});
    ModuleClass(option)(constructor);
  };
}
