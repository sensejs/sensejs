import {Component, ComponentScope, Scope} from './component.js';
import {ComponentFactory, Constructor, ServiceIdentifier} from './interfaces.js';
import {Subject} from 'rxjs';
import {createModule, Module, ModuleOption, OnModuleStart, OnModuleStop} from './module.js';
import {Container, InjectScope, Middleware} from '@sensejs/container';
import {Inject} from './decorators.js';
import {ModuleScanner} from './module-scanner.js';
import {matchLabels} from './utils/match-labels.js';

export interface EventChannelSubscription {
  unsubscribe(): void;
}

interface EventMessenger {
  payload: unknown;
}

interface AcknowledgeAwareEventMessenger extends EventMessenger {
  acknowledge: (processPromise: Promise<unknown>) => void;
}

@Component()
@Scope(InjectScope.SINGLETON)
class EventBusImplement {
  #channels: Map<ServiceIdentifier, Subject<AcknowledgeAwareEventMessenger>> = new Map();

  async announceEvent<T extends {}, Context>(channel: ServiceIdentifier, payload: any): Promise<void> {
    const subject = this.#ensureEventChannel(channel);
    const consumePromises: Promise<unknown>[] = [];
    subject.next({
      payload,
      acknowledge: (p: Promise<unknown>) => consumePromises.push(p),
    });
    await Promise.all(consumePromises);
  }

  subscribe<T>(
    target: ServiceIdentifier<T>,
    callback: (payload: AcknowledgeAwareEventMessenger) => void,
  ): EventChannelSubscription {
    return this.#ensureEventChannel(target).subscribe({
      next: callback,
    });
  }

  #ensureEventChannel<T>(target: ServiceIdentifier<T>): Subject<AcknowledgeAwareEventMessenger> {
    let channel = this.#channels.get(target);
    if (typeof channel !== 'undefined') {
      return channel;
    }
    channel = new Subject<AcknowledgeAwareEventMessenger>();
    this.#channels.set(target, channel);
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
  middlewares: Constructor<Middleware>[];
}

export interface EventSubscriptionOption {
  middlewares?: Constructor<Middleware>[];
  filter?: (message: any) => boolean;
}

export interface SubscribeEventControllerMetadata {
  middlewares: Constructor<Middleware>[];

  labels: Set<symbol | string>;
}

export interface SubscribeEventControllerOption {
  middlewares?: Constructor<Middleware>[];
  labels?: (string | symbol)[] | Set<symbol | string>;
}

export function setSubscribeEventControllerMetadata(
  target: Constructor,
  metadata: SubscribeEventControllerMetadata,
): void {
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
      middlewares: option.middlewares ?? [],
      labels: new Set(option.labels),
    });
  };
}

/**
 * Mark a method as event subscriber
 * @decorator
 */
export function SubscribeEvent(identifier: ServiceIdentifier, option: EventSubscriptionOption = {}) {
  return <P extends {}>(prototype: P, name: keyof P & (string | symbol)): void => {
    const targetMethod = prototype[name];
    if (typeof targetMethod !== 'function') {
      throw new TypeError('SubscribeEvent cannot be apply to non-function types');
    }
    const metadata: SubscribeEventMetadata<P> = {
      prototype,
      name,
      identifier,
      middlewares: option.middlewares ?? [],
      filter: option.filter ?? (() => true),
    };
    Reflect.defineMetadata(SUBSCRIBE_EVENT_KEY, metadata, targetMethod);
  };
}

export function getEventSubscriptionMetadata<P extends {} = {}>(
  target: Function,
): SubscribeEventMetadata<P> | undefined {
  return Reflect.getMetadata(SUBSCRIBE_EVENT_KEY, target);
}

export interface EventSubscriptionModuleOption extends ModuleOption {
  middlewares?: Constructor<Middleware>[];
  matchLabels?: Set<string | symbol> | (string | symbol)[] | ((labels: Set<string | symbol>) => boolean);
}

export class EventSubscriptionContext {
  constructor(
    public readonly identifier: ServiceIdentifier,
    public readonly targetConstructor: Constructor,
    public readonly targetMethodKey: keyof any,
    public readonly payload: any,
  ) {}
}

export abstract class EventPublishPreparation {
  abstract bind<T>(serviceIdentifier: ServiceIdentifier<T>, value: T): this;

  // abstract publish<T>(): Promise<void>;
  //
  // abstract publish<T>(serviceIdentifier: ServiceIdentifier<T>, payload: T): Promise<void>;
}

export abstract class EventPublisher {
  abstract publish(channel: ServiceIdentifier, payload: any): Promise<void>;
}

@Component()
@Scope(Scope.SINGLETON)
class EventPublisherFactory extends ComponentFactory<EventPublisher> {
  private static EventPublisher = class extends EventPublisher {
    constructor(private readonly container: Container, private readonly eventBus: EventBusImplement) {
      super();
    }

    publish(channel: ServiceIdentifier, payload: any) {
      return this.eventBus.announceEvent(channel, payload);
      // return new EventPublisherFactory.EventPublishPreparation(this.eventBus, channel).publish(payload);
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
    factories: [{provide: EventPublisher, factory: EventPublisherFactory, scope: ComponentScope.SINGLETON}],
  });
  @Module({requires: [createModule(option), eventBusModule]})
  class EventSubscriptionModule {
    private subscriptions: EventChannelSubscription[] = [];

    constructor(
      @Inject(Container) private container: Container,
      @Inject(ModuleScanner) private scanner: ModuleScanner,
      @Inject(EventBusImplement) private eventBus: EventBusImplement,
    ) {}

    @OnModuleStart()
    onStart() {
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

    @OnModuleStop()
    onStop() {
      this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    }

    private scanPrototype(constructor: Constructor, metadata: SubscribeEventControllerMetadata) {
      const subscribeEventMetadataList = Object.values(Object.getOwnPropertyDescriptors(constructor.prototype))
        .map((pd) => pd.value)
        .filter((value): value is Function => typeof value === 'function')
        .map(getEventSubscriptionMetadata)
        .filter((value): value is SubscribeEventMetadata => typeof value !== 'undefined');

      subscribeEventMetadataList.forEach((subscribeEventMetadata) => {
        this.#setupEventSubscription(constructor, metadata, subscribeEventMetadata);
      });
    }

    #setupEventSubscription(
      constructor: Constructor,
      controllerMetadata: SubscribeEventControllerMetadata,
      subscribeEventMetadata: SubscribeEventMetadata,
    ) {
      const {name} = subscribeEventMetadata;
      const invoker = this.container.createMethodInvoker(
        constructor,
        name,
        [...controllerMetadata.middlewares, ...subscribeEventMetadata.middlewares],
        EventSubscriptionContext,
      );

      const identifier = subscribeEventMetadata.identifier;
      this.subscriptions.push(
        this.eventBus.subscribe(identifier, (messenger) => {
          const {acknowledge, payload} = messenger;
          try {
            if (!subscribeEventMetadata.filter(payload)) {
              return;
            }
          } catch (e) {
            acknowledge(Promise.reject(e));
            return;
          }
          acknowledge(invoker.invoke(new EventSubscriptionContext(identifier, constructor, name, payload)));
        }),
      );
    }
  }

  return EventSubscriptionModule;
}
