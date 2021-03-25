import {Component, ComponentScope} from './component';
import {ComponentFactory, Constructor, ServiceIdentifier} from './interfaces';
import {Subject} from 'rxjs';
import {RequestContext, RequestInterceptor} from './interceptor';
import {createModule, ModuleClass, ModuleOption, OnModuleCreate, OnModuleDestroy} from './module';
import {Container, ResolveContext} from '@sensejs/container';
import {Inject} from './decorators';
import {MethodInvokerBuilder} from './method-inject';
import {ModuleScanner} from './module-scanner';
import {matchLabels} from './utils';

export interface EventChannelSubscription {
  unsubscribe(): void;
}

interface EventMessenger {

  payload: unknown;

  resolveContext: ResolveContext
}

interface AcknowledgeAwareEventMessenger extends EventMessenger {
  acknowledge: (processPromise: Promise<void>) => void;
}

/**
 * Describe how an event announcement will be performed
 */
export interface AnnounceEventOption<T, Context> {

  /**
   * To which channel the event is announced
   */
  channel: ServiceIdentifier;

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
    resolveContext: ResolveContext,
    payload?: unknown
  ): Promise<void> {
    const subject = this.ensureEventChannel(channel);
    const consumePromises: Promise<void>[] = [];
    subject.next({
      payload,
      resolveContext,
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

export function setSubscribeEventControllerMetadata(target: Constructor, metadata: SubscribeEventControllerMetadata) {
  if (Reflect.hasMetadata(SUBSCRIBE_EVENT_CONTROLLER_KEY, target)) {
    throw new Error(`@SubscribeEventController() cannot applied multiple times on "${target.name}"`);
  }
  Reflect.defineMetadata(SUBSCRIBE_EVENT_CONTROLLER_KEY, metadata, target);
}

export function getSubscribeEventControllerMetadata(target: Constructor): SubscribeEventControllerMetadata | undefined {
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

export function getEventSubscriptionMetadata<P extends {} = {}>(
  target: Function,
): SubscribeEventMetadata<P> | undefined {
  return Reflect.getMetadata(SUBSCRIBE_EVENT_KEY, target);
}

export interface EventSubscriptionModuleOption extends ModuleOption {
  interceptors?: Constructor<RequestInterceptor>[];
  matchLabels?: Set<string | symbol> | (string | symbol)[] | ((labels: Set<string | symbol>) => boolean);
}

export class EventSubscriptionContext extends RequestContext {

  constructor(
    protected  resolveContext: ResolveContext,
    public readonly identifier: ServiceIdentifier,
    public readonly targetConstructor: Constructor,
    public readonly targetMethodKey: keyof any,
    public readonly payload: unknown,
  ) {
    super();
  }
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
      private readonly resolveContext: ResolveContext,
      private readonly eventBus: EventBusImplement,
      private readonly channel: ServiceIdentifier,
    ) {
      super();
    }

    bind<T>(serviceIdentifier: ServiceIdentifier<T>, value: T): this {
      this.resolveContext.addTemporaryConstantBinding(serviceIdentifier, value);
      return this;
    }

    async publish<T>(...args: [undefined] | [ServiceIdentifier<T>, T]): Promise<void> {
      if (args[0] !== undefined) {
        this.resolveContext.addTemporaryConstantBinding(args[0], args[1]);
        return this.eventBus.announceEvent(this.channel, this.resolveContext, args[1]);
      }
      return this.eventBus.announceEvent(this.channel, this.resolveContext);
    }
  };

  private static EventPublisher = class extends EventPublisher {
    constructor(private readonly container: Container, private readonly eventBus: EventBusImplement) {
      super();
    }

    prepare(channel: ServiceIdentifier): EventPublishPreparation {
      return new EventPublisherFactory.EventPublishPreparation(this.container.createResolveContext(), this.eventBus, channel);
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


export function createEventSubscriptionModule(option: EventSubscriptionModuleOption = {}): Constructor {
  const eventBusModule = createModule({
    components: [EventBusImplement],
    factories: [
      {provide: EventPublisher, factory: EventPublisherFactory, scope: ComponentScope.SINGLETON},
    ],
  });
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
          const {acknowledge, resolveContext, payload} = messenger;
          try {
            if (!subscribeEventMetadata.filter(payload)) {
              return;
            }
          } catch (e) {
            acknowledge(Promise.reject(e));
            return;
          }
          acknowledge(
            methodInvokerBuilder
              .setResolveContext(resolveContext)
              .build(constructor, subscribeEventMetadata.name)
              .invoke({
                contextFactory: (resolveContext, targetConstructor, targetMethodKey) => {
                  return new EventSubscriptionContext(
                    resolveContext,
                    identifier,
                    targetConstructor,
                    targetMethodKey,
                    payload,
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

