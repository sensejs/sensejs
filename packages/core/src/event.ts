import {Component} from './component';
import {ComponentFactory, ComponentScope, Constructor, ServiceIdentifier} from './interfaces';
import {Subject} from 'rxjs';
import {RequestContext, RequestInterceptor} from './interceptor';
import {createModule, ModuleClass, ModuleOption, OnModuleCreate, OnModuleDestroy} from './module';
import {Container} from 'inversify';
import {Inject, InjectionDecorator} from './decorators';
import {MethodInvokerBuilder} from './method-inject';
import {ModuleScanner} from './module-scanner';
import {Deprecated, matchLabels} from './utils';

export interface EventChannelSubscription {
  unsubscribe(): void;
}

interface EventMessenger {
  /**
   * @deprecated
   */
  payload?: unknown;
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

@Component({scope: ComponentScope.SINGLETON})
class EventBusImplement {
  private channels: Map<ServiceIdentifier, Subject<AcknowledgeAwareEventMessenger>> = new Map();

  async announceEvent<T extends {}, Context>(
    channel: ServiceIdentifier,
    container: Container,
    payload?: unknown,
    context?: unknown,
  ): Promise<void> {
    const subject = this.ensureEventChannel(channel);
    const consumePromises: Promise<void>[] = [];
    subject.next({
      container,
      payload,
      context,
      acknowledge: (p: Promise<void>) => consumePromises.push(p),
    });
    await Promise.all(consumePromises);
  }

  subscribe<T>(
    target: ServiceIdentifier<T>,
    callback: (payload: AcknowledgeAwareEventMessenger) => void,
  ): EventChannelSubscription {
    return this.ensureEventChannel(target).subscribe({
      next: callback,
    });
  }

  private ensureEventChannel<T>(target: ServiceIdentifier<T>): Subject<AcknowledgeAwareEventMessenger> {
    let channel = this.channels.get(target);
    if (typeof channel !== 'undefined') {
      return channel;
    }
    channel = new Subject<AcknowledgeAwareEventMessenger>();
    this.channels.set(target, channel);
    return channel;
  }
}

const SUBSCRIBE_EVENT_KEY = Symbol();

const SUBSCRIBE_EVENT_CONTROLLER_KEY = Symbol();

export interface SubscribeEventMetadata<P extends {} = {}> {
  prototype: P;
  name: keyof P & (string | symbol);
  identifier: ServiceIdentifier;
  filter: (message: any) => boolean;
  interceptors: Constructor<RequestInterceptor>[];
}

export interface EventSubscriptionOption {
  interceptors?: Constructor<RequestInterceptor>[];
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
  return <P extends {}>(prototype: P, name: keyof P & (string | symbol)): void => {
    const metadata: SubscribeEventMetadata<P> = {
      prototype,
      name,
      identifier,
      interceptors: option.interceptors ?? [],
      filter: option.filter ?? (() => true),
    };
    Reflect.defineMetadata(SUBSCRIBE_EVENT_KEY, metadata, prototype[name]);
  };
}

function getEventSubscriptionMetadata<P extends {} = {}>(target: Function): SubscribeEventMetadata<P> | undefined {
  return Reflect.getMetadata(SUBSCRIBE_EVENT_KEY, target);
}

export interface EventSubscriptionModuleOption extends ModuleOption {
  interceptors?: Constructor<RequestInterceptor>[];
  matchLabels?: Set<string | symbol> | (string | symbol)[] | ((labels: Set<string | symbol>) => boolean);
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
   * @param channel
   * @param payload
   * @deprecated
   */
  announceEvent<T>(channel: ServiceIdentifier<T>, payload: T): Promise<void>;

  /**
   * Announce event in a way that described by {AnnounceEventOption}
   * @param option
   * @deprecated
   */
  announceEvent<T, Context>(option: AnnounceEventOption<T, Context>): Promise<void>;

  bind<T>(target: ServiceIdentifier<T>, value: T): this;

  announce(channel: ServiceIdentifier): Promise<void>;
}

export abstract class EventPublishPreparation {
  abstract bind<T>(serviceIdentifier: ServiceIdentifier<T>, value: T): this;

  abstract publish<T>(): Promise<void>;

  abstract publish<T>(serviceIdentifier: ServiceIdentifier<T>, payload: T): Promise<void>;
}

export abstract class EventPublisher {
  abstract prepare(channel: ServiceIdentifier): EventPublishPreparation;
}

@Component({scope: ComponentScope.SINGLETON})
class EventPublisherFactory extends ComponentFactory<EventPublisher> {
  private static EventPublishPreparation = class extends EventPublishPreparation {
    constructor(
      private readonly container: Container,
      private readonly eventBus: EventBusImplement,
      private readonly channel: ServiceIdentifier,
    ) {
      super();
    }

    bind<T>(serviceIdentifier: ServiceIdentifier<T>, value: T): this {
      this.container.bind(serviceIdentifier).toConstantValue(value);
      return this;
    }

    async publish<T>(...args: [undefined] | [ServiceIdentifier<T>, T]): Promise<void> {
      if (args[0] !== undefined) {
        this.container.bind(args[0]).toConstantValue(args[1]);
        return this.eventBus.announceEvent(this.channel, this.container, args[1]);
      }
      return this.eventBus.announceEvent(this.channel, this.container);
    }
  };

  private static EventPublisher = class extends EventPublisher {
    constructor(private readonly container: Container, private readonly eventBus: EventBusImplement) {
      super();
    }

    prepare(channel: ServiceIdentifier): EventPublishPreparation {
      return new EventPublisherFactory.EventPublishPreparation(this.container.createChild(), this.eventBus, channel);
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
    let channel: ServiceIdentifier;
    let symbol: ServiceIdentifier;
    let payload: any;
    let context: any;
    if (typeof option === 'object') {
      channel = option.channel;
      payload = option.payload;
      symbol = option.symbol ?? channel;
      context = option.context;
    } else {
      channel = symbol = option;
      payload = rest[0];
    }
    this.bind(symbol, payload);
    const origin = this.recreateContainer();
    await this.eventBus.announceEvent(channel, origin, payload, context);
  }

  bind<T>(serviceIdentifier: ServiceIdentifier<T>, value: T): this {
    this.childContainer.bind(serviceIdentifier).toConstantValue(value);
    return this;
  }

  async announce(channel: ServiceIdentifier): Promise<void> {
    const origin = this.recreateContainer();
    await this.eventBus.announceEvent(channel, origin);
  }
}

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
 * @param channel Channel to be announced
 * @deprecated
 */
export function InjectEventAnnouncer<T>(channel: ServiceIdentifier): InjectionDecorator;

export function InjectEventAnnouncer<T>(identifier?: ServiceIdentifier<T>): InjectionDecorator {
  if (typeof identifier !== 'undefined') {
    return Inject(EventAnnouncer, {
      transform: (eventBus) => (payload: T) => eventBus.announceEvent(identifier, payload),
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

          if (!matchLabels(metadata.labels, option.matchLabels)) {
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

      const identifier = subscribeEventMetadata.identifier;
      this.subscriptions.push(
        this.eventBus.subscribe(identifier, (messenger) => {
          const {acknowledge, container, payload, context} = messenger;
          try {
            if (!subscribeEventMetadata.filter(messenger.payload)) {
              return;
            }
          } catch (e) {
            acknowledge(Promise.reject(e));
            return;
          }
          acknowledge(
            methodInvokerBuilder
              .setContainer(container)
              .build(constructor, subscribeEventMetadata.name)
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
