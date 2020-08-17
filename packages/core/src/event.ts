import {Component} from './component';
import {ComponentFactory, ComponentScope, Constructor, ServiceIdentifier} from './interfaces';
import {Subject, Subscription} from 'rxjs';
import {RequestContext, RequestInterceptor} from './interceptor';
import {createModule, ModuleClass, ModuleOption, OnModuleCreate, OnModuleDestroy} from './module';
import {Container} from 'inversify';
import {Inject, InjectionDecorator} from './decorators';
import {MethodInvokerBuilder} from './method-inject';
import {ModuleScanner} from './module-scanner';
import {Deprecated} from './utils';

export interface EventChannelSubscription {
  unsubscribe(): void;
}

interface EventMessenger {
  payload: unknown;
  /**
   * @deprecated
   */
  context: unknown;

  container: Container;
}

interface AcknowledgeAwareEventMessenger extends EventMessenger {
  acknowledge: (processPromise: Promise<void>) => void;
}

/**
 * Describe how an event announcement will be performed
 */
export interface AnnounceEventOption<T, Context> {
  /**
   * Context object that can be used in interceptor
   *
   * @deprecated
   */
  context?: Context;

  /**
   * To which channel the event is announced
   */
  channel: ServiceIdentifier;

  /**
   * The payload of this event
   *
   * @deprecated
   */
  payload: T;

  /**
   * Using which symbol the payload can be injected, if not specified, default to `channel`
   */
  symbol?: ServiceIdentifier;
}

class SubscriptionInfo {
  constructor(
    public readonly channel: EventChannel,
    public readonly subscription: Subscription,
    public readonly subscriberInfo: SubscriberInfo,
  ) {}

  unsubscribe() {
    this.subscription.unsubscribe();
    this.channel.subscribers.delete(this);
  }
}

class EventChannel {
  public readonly subject = new Subject<AcknowledgeAwareEventMessenger>();
  public readonly subscribers: Set<SubscriptionInfo> = new Set();

  public subscribe(
    subscriberInfo: SubscriberInfo,
    callback: (payload: AcknowledgeAwareEventMessenger) => void,
  ): SubscriptionInfo {
    const subscription = this.subject.subscribe({
      next: callback,
    });
    const subscriptionInfo = new SubscriptionInfo(this, subscription, subscriberInfo);
    this.subscribers.add(subscriptionInfo);
    return subscriptionInfo;
  }
}

@Component({scope: ComponentScope.SINGLETON})
class EventBusImplement {
  private channels: Map<ServiceIdentifier, EventChannel> = new Map();

  async announceEvent<T extends {}, Context>(
    channelId: ServiceIdentifier,
    container: Container,
    payload?: unknown,
    context?: unknown,
  ): Promise<void> {
    const channel = this.ensureEventChannel(channelId);
    const consumePromises: Promise<void>[] = [];
    channel.subject.next({
      container,
      payload,
      context,
      acknowledge: (p: Promise<void>) => consumePromises.push(p),
    });
    await Promise.all(consumePromises);
  }

  subscribe<T>(
    channelId: ServiceIdentifier<T>,
    subscriberInfo: SubscriberInfo,
    callback: (payload: AcknowledgeAwareEventMessenger) => void,
  ): EventChannelSubscription {
    const channel = this.ensureEventChannel(channelId);
    return channel.subscribe(subscriberInfo, callback);
  }

  listSubscriber(channelId: ServiceIdentifier): SubscriberInfo[] {
    return Array.from(this.channels.get(channelId)?.subscribers.values() ?? []).map((value) => value.subscriberInfo);
  }

  private ensureEventChannel<T>(channelId: ServiceIdentifier<T>): EventChannel {
    let channel = this.channels.get(channelId);
    if (typeof channel !== 'undefined') {
      return channel;
    }
    channel = new EventChannel();
    this.channels.set(channelId, channel);
    return channel;
  }
}

const SUBSCRIBE_EVENT_KEY = Symbol();

const SUBSCRIBE_EVENT_CONTROLLER_KEY = Symbol();

interface SubscriberInfo<P extends {} = {}> {
  prototype: P;
  id?: string;
  targetMethod: keyof P & (string | symbol);
}

export interface SubscribeEventMetadata<P extends {} = {}> {
  prototype: P;
  id?: string;
  targetMethod: keyof P & (string | symbol);
  identifier: ServiceIdentifier;
  filter: (message: any) => boolean;
  interceptors: Constructor<RequestInterceptor>[];
}

export interface EventSubscriptionOption {
  interceptors?: Constructor<RequestInterceptor>[];
  id?: string;
  filter?: (message: any) => boolean;
}

export interface SubscribeEventControllerMetadata {
  interceptors: Constructor<RequestInterceptor>[];
  labels: Set<symbol | string>;
}

export interface SubscribeEventControllerOption {
  interceptors?: Constructor<RequestInterceptor>[];
  labels?: (string | symbol)[] | Set<symbol | string>;
}

function setSubscribeEventControllerMetadata(target: Constructor, metadata: SubscribeEventControllerMetadata) {
  if (Reflect.hasMetadata(SUBSCRIBE_EVENT_CONTROLLER_KEY, target)) {
    throw new Error(`@SubscribeEventController() cannot applied multiple times on "${target.name}"`);
  }
  Reflect.defineMetadata(SUBSCRIBE_EVENT_CONTROLLER_KEY, metadata, target);
}

function getSubscribeEventControllerMetadata(target: Constructor): SubscribeEventControllerMetadata | undefined {
  return Reflect.getMetadata(SUBSCRIBE_EVENT_CONTROLLER_KEY, target);
}

export function SubscribeEventController(option: SubscribeEventControllerOption = {}) {
  return (constructor: Constructor): void => {
    Component()(constructor);
    setSubscribeEventControllerMetadata(constructor, {
      interceptors: option.interceptors ?? [],
      labels: new Set(option.labels),
    });
  };
}

/**
 * Mark an method as event subscriber
 * @decorator
 */
export function SubscribeEvent(identifier: ServiceIdentifier, option: EventSubscriptionOption = {}) {
  return <P extends {}>(prototype: P, targetMethod: keyof P & (string | symbol)): void => {
    const metadata: SubscribeEventMetadata<P> = {
      prototype,
      targetMethod,
      identifier,
      interceptors: option.interceptors ?? [],
      filter: option.filter ?? (() => true),
      id: option.id,
    };
    Reflect.defineMetadata(SUBSCRIBE_EVENT_KEY, metadata, prototype[targetMethod]);
  };
}

function getEventSubscriptionMetadata<P extends {} = {}>(target: Function): SubscribeEventMetadata<P> | undefined {
  return Reflect.getMetadata(SUBSCRIBE_EVENT_KEY, target);
}

export interface EventSubscriptionModuleOption extends ModuleOption {
  interceptors?: Constructor<RequestInterceptor>[];
  matchLabels?: Set<string | symbol> | (string | symbol)[];
}

export class EventSubscriptionContext extends RequestContext {
  /**
   * @deprecated
   */
  public readonly payload: unknown;
  /**
   * @deprecated
   */
  public readonly context: unknown;

  constructor(
    private container: Container,
    public readonly identifier: ServiceIdentifier,
    public readonly targetConstructor: Constructor,
    public readonly targetMethodKey: keyof any,
    payload: unknown,
    context: unknown,
  ) {
    super();
    this.payload = payload;
    this.context = context;
    container.bind(EventSubscriptionContext).toConstantValue(this);
  }

  bindContextValue<T>(key: ServiceIdentifier<T>, value: T): void {
    this.container.bind(key).toConstantValue(value);
  }
}

/**
 * @deprecated
 */
export interface EventAnnouncer {
  /**
   * Announce event, payload can be injected using target as symbol
   * @param channelId
   * @param payload
   * @deprecated
   */
  announceEvent<T>(channelId: ServiceIdentifier<T>, payload: T): Promise<void>;

  /**
   * Announce event in a way that described by {AnnounceEventOption}
   * @param option
   * @deprecated
   */
  announceEvent<T, Context>(option: AnnounceEventOption<T, Context>): Promise<void>;

  bind<T>(target: ServiceIdentifier<T>, value: T): this;

  announce(channelId: ServiceIdentifier): Promise<void>;
}

export abstract class EventPublishPreparation {
  abstract bind<T>(serviceIdentifier: ServiceIdentifier<T>, value: T): this;

  abstract publish(): Promise<void>;
}

export abstract class EventPublisher {
  abstract prepare(channelId: ServiceIdentifier): EventPublishPreparation;

  abstract getSubscribers(channelId: ServiceIdentifier): SubscriberInfo[];
}

@Component({scope: ComponentScope.SINGLETON})
class EventPublisherFactory extends ComponentFactory<EventPublisher> {
  private static EventPublishPreparation = class extends EventPublishPreparation {
    constructor(
      private readonly container: Container,
      private readonly eventBus: EventBusImplement,
      private readonly channelId: ServiceIdentifier,
    ) {
      super();
    }

    bind<T>(serviceIdentifier: ServiceIdentifier<T>, value: T): this {
      this.container.bind(serviceIdentifier).toConstantValue(value);
      return this;
    }

    async publish(): Promise<void> {
      await this.eventBus.announceEvent(this.channelId, this.container);
    }
  };

  private static EventPublisher = class extends EventPublisher {
    constructor(readonly container: Container, readonly eventBus: EventBusImplement) {
      super();
    }

    prepare(channelId: ServiceIdentifier): EventPublishPreparation {
      return new EventPublisherFactory.EventPublishPreparation(this.container.createChild(), this.eventBus, channelId);
    }

    getSubscribers(channelId: ServiceIdentifier): SubscriberInfo[] {
      return this.eventBus.listSubscriber(channelId);
    }
  };

  constructor(
    @Inject(EventBusImplement) private eventBus: EventBusImplement,
    @Inject(Container) private container: Container,
  ) {
    super();
  }

  build(): EventPublisher {
    return new EventPublisherFactory.EventPublisher(this.container, this.eventBus);
  }
}

/**
 * @deprecated
 */
@Deprecated()
export class EventAnnouncer {
  private childContainer: Container;

  constructor(private readonly container: Container, private readonly eventBus: EventBusImplement) {
    this.childContainer = container.createChild();
  }

  private recreateContainer() {
    const origin = this.childContainer;
    this.childContainer = this.container.createChild();
    return origin;
  }

  async announceEvent<T, Context>(
    option: ServiceIdentifier<T> | AnnounceEventOption<T, Context>,
    ...rest: T[]
  ): Promise<void> {
    let channelId: ServiceIdentifier;
    let symbol: ServiceIdentifier;
    let payload: any;
    let context: any;
    if (typeof option === 'object') {
      channelId = option.channel;
      payload = option.payload;
      symbol = option.symbol ?? channelId;
      context = option.context;
    } else {
      channelId = symbol = option;
      payload = rest[0];
    }
    this.bind(symbol, payload);
    const origin = this.recreateContainer();
    await this.eventBus.announceEvent(channelId, origin, payload, context);
  }

  bind<T>(serviceIdentifier: ServiceIdentifier<T>, value: T): this {
    this.childContainer.bind(serviceIdentifier).toConstantValue(value);
    return this;
  }

  async announce(channelId: ServiceIdentifier): Promise<void> {
    const origin = this.recreateContainer();
    await this.eventBus.announceEvent(channelId, origin);
  }
}

/**
 * @deprecated
 */
@Component({scope: ComponentScope.SINGLETON})
class EventAnnouncerFactory extends ComponentFactory<EventAnnouncer> {
  constructor(
    @Inject(EventBusImplement) private eventBus: EventBusImplement,
    @Inject(Container) private container: Container,
  ) {
    super();
  }

  build() {
    return new EventAnnouncer(this.container, this.eventBus);
  }
}

/**
 * Short for `Inject(EventAnnouncer)`
 */
export function InjectEventAnnouncer<T>(): InjectionDecorator;

/**
 * @param channelId Channel to be announced
 * @deprecated
 */
export function InjectEventAnnouncer<T>(channelId: ServiceIdentifier): InjectionDecorator;

export function InjectEventAnnouncer<T>(channelId?: ServiceIdentifier<T>): InjectionDecorator {
  if (typeof channelId !== 'undefined') {
    return Inject(EventAnnouncer, {
      transform: (eventBus) => (payload: T) => eventBus.announceEvent(channelId, payload),
    });
  }
  return Inject(EventAnnouncer);
}

const eventBusModule = createModule({
  components: [EventBusImplement],
  factories: [
    {provide: EventAnnouncer, factory: EventAnnouncerFactory, scope: ComponentScope.SINGLETON},
    {provide: EventPublisher, factory: EventPublisherFactory, scope: ComponentScope.SINGLETON},
  ],
});

export function createEventSubscriptionModule(option: EventSubscriptionModuleOption = {}): Constructor {
  @ModuleClass({requires: [createModule(option), eventBusModule]})
  class EventSubscriptionModule {
    private subscriptions: EventChannelSubscription[] = [];
    private methodInvokerBuilder = MethodInvokerBuilder.create<EventSubscriptionContext>(this.container);

    constructor(
      @Inject(Container) private container: Container,
      @Inject(ModuleScanner) private scanner: ModuleScanner,
      @Inject(EventBusImplement) private eventBus: EventBusImplement,
    ) {
      if (option.interceptors) {
        this.methodInvokerBuilder.addInterceptor(...option.interceptors);
      }
    }

    @OnModuleCreate()
    onModuleCreate() {
      this.scanner.scanModule((moduleMetadata) => {
        moduleMetadata.components.forEach((component) => {
          const metadata = getSubscribeEventControllerMetadata(component);
          if (typeof metadata === 'undefined') {
            return;
          }
          this.scanPrototype(component, metadata);
        });
      });
    }

    @OnModuleDestroy()
    onModuleDestroy() {
      this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    }

    private scanPrototype(constructor: Constructor, metadata: SubscribeEventControllerMetadata) {
      const subscribeEventMetadataList = Object.values(Object.getOwnPropertyDescriptors(constructor.prototype))
        .map((pd) => pd.value)
        .filter((value): value is Function => typeof value === 'function')
        .map(getEventSubscriptionMetadata)
        .filter((value): value is SubscribeEventMetadata => typeof value !== 'undefined');

      subscribeEventMetadataList.forEach((subscribeEventMetadata) => {
        this.setupEventSubscription(
          constructor,
          this.methodInvokerBuilder.clone().addInterceptor(...metadata.interceptors),
          subscribeEventMetadata,
        );
      });
    }

    private setupEventSubscription(
      constructor: Constructor,
      methodInvokerBuilder: MethodInvokerBuilder<EventSubscriptionContext>,
      subscribeEventMetadata: SubscribeEventMetadata,
    ) {
      methodInvokerBuilder = methodInvokerBuilder.clone().addInterceptor(...subscribeEventMetadata.interceptors);

      const {identifier, prototype, targetMethod, id} = subscribeEventMetadata;
      this.subscriptions.push(
        this.eventBus.subscribe(identifier, {prototype, targetMethod: targetMethod, id}, (messenger) => {
          if (!subscribeEventMetadata.filter(messenger.payload)) {
            return;
          }
          const {acknowledge, container, payload, context} = messenger;
          acknowledge(
            methodInvokerBuilder
              .setContainer(container)
              .build(constructor, subscribeEventMetadata.targetMethod)
              .invoke({
                contextFactory: (container, targetConstructor, targetMethodKey) => {
                  return new EventSubscriptionContext(
                    container,
                    identifier,
                    targetConstructor,
                    targetMethodKey,
                    payload,
                    context,
                  );
                },
              }),
          );
        }),
      );
    }
  }

  return EventSubscriptionModule;
}
