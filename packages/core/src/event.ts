import {Component} from './component';
import {ComponentFactory, ComponentScope, Constructor, ServiceIdentifier} from './interfaces';
import {Subject} from 'rxjs';
import {composeRequestInterceptor, RequestContext, RequestInterceptor} from './interceptor';
import {createModule, ModuleClass, ModuleOption, OnModuleCreate, OnModuleDestroy} from './module';
import {Container} from 'inversify';
import {Inject} from './decorators';
import {invokeMethod} from './method-inject';
import {ModuleScanner} from './module-scanner';

export interface EventChannelSubscription {
  unsubscribe(): void;
}

export interface EventChannelAnnouncer<T> {
  (payload: T): Promise<void>;
}

interface EventMessenger<T> {
  payload: T;
  acknowledge: (processPromise: Promise<void>) => void;
}

@Component({scope: ComponentScope.SINGLETON})
export class EventBusImplement {

  private channels: Map<ServiceIdentifier, Subject<EventMessenger<unknown>>> = new Map();

  async announceEvent<T>(target: ServiceIdentifier<T>, payload: T) {
    const subject = this.ensureEventChannel(target);
    const consumePromises: Promise<void>[] = [];
    subject.next({
      payload,
      acknowledge: (p: Promise<void>) => consumePromises.push(p),
    });
    return Promise.all(consumePromises);
  }

  subscribe<T>(target: ServiceIdentifier<T>, callback: (payload: T) => Promise<void>): EventChannelSubscription {
    return this.ensureEventChannel(target).subscribe({
      next: (broadcast) => {
        broadcast.acknowledge(callback(broadcast.payload as T));
      },
    });
  }

  private ensureEventChannel<T = unknown>(target: ServiceIdentifier<T>) {

    let channel = this.channels.get(target);
    if (typeof channel === 'undefined') {
      channel = new Subject();
      this.channels.set(target, channel);
    }
    return channel;
  }
}

const SUBSCRIBE_EVENT_KEY = Symbol();

const SUBSCRIBE_EVENT_CONTROLLER_KEY = Symbol();

export interface SubscribeEventMetadata<P extends {} = {}> {
  prototype: P;
  name: keyof P & (string | symbol);
  identifier: ServiceIdentifier;
  filter: (message: unknown) => boolean;
  interceptors: Constructor<RequestInterceptor>[];
}

export interface EventSubscriptionOption {
  interceptors?: Constructor<RequestInterceptor>[];
  filter?: (message: unknown) => boolean;
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
  return (constructor: Constructor) => {
    Component()(constructor);
    setSubscribeEventControllerMetadata(constructor, {
      interceptors: option.interceptors ?? [],
      labels: new Set(option.labels),
    });
  };
}

/**
 *
 * @decorator
 */
export function SubscribeEvent(identifier: ServiceIdentifier, option: EventSubscriptionOption = {}) {
  return <P extends {}>(prototype: P, name: keyof P & (string | symbol)) => {
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
  matchLabels?: Set<string | symbol> | (string | symbol)[];
}

export class EventSubscriptionContext<Payload> extends RequestContext {
  constructor(
    private container: Container,
    public readonly identifier: ServiceIdentifier,
    public readonly payload: Payload,
  ) {
    super();
    container.bind(EventSubscriptionContext).toConstantValue(this);
  }

  bindContextValue<T>(key: ServiceIdentifier<T>, value: T): void {
    this.container.bind(key).toConstantValue(value);
  }
}

export abstract class EventAnnouncer {
  abstract announceEvent<T>(channel: ServiceIdentifier<T>, payload: T): Promise<void>;
}

@Component({scope: ComponentScope.SINGLETON})
class EventAnnouncerFactory extends ComponentFactory<EventAnnouncer> {

  private readonly eventAnnouncer: EventAnnouncer;

  constructor(@Inject(EventBusImplement) implement: EventBusImplement) {
    super();
    this.eventAnnouncer = new class extends EventAnnouncer {
      async announceEvent<T>(channel: ServiceIdentifier, payload: T): Promise<void> {
        await implement.announceEvent(channel, payload);
      }
    };
  }

  build() {
    return this.eventAnnouncer;
  }
}

export function InjectEventAnnouncer<T>(identifier?: ServiceIdentifier<T>) {
  if (typeof identifier !== 'undefined') {
    return Inject(EventAnnouncer, {
      transform: (eventBus) => (payload: T) => eventBus.announceEvent(identifier, payload),
    });
  }
  return Inject(EventAnnouncer);
}

const eventBusModule = createModule({
  components: [EventBusImplement],
  factories: [{provide: EventAnnouncer, factory: EventAnnouncerFactory, scope: ComponentScope.SINGLETON}],
});

export function createEventSubscriptionModule(option: EventSubscriptionModuleOption = {}): Constructor {

  @ModuleClass({requires: [createModule(option), eventBusModule]})
  class EventSubscriptionModule {

    private subscriptions: EventChannelSubscription[] = [];

    constructor(
      @Inject(Container) private container: Container,
      @Inject(ModuleScanner) private scanner: ModuleScanner,
      @Inject(EventBusImplement) private eventBus: EventBusImplement,
    ) {}

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
        this.setupEventSubscription(constructor, metadata, subscribeEventMetadata);
      });
    }

    private setupEventSubscription(
      constructor: Constructor,
      metadata: SubscribeEventControllerMetadata,
      subscribeEventMetadata: SubscribeEventMetadata,
    ) {
      const interceptors = [
        ...(
          option.interceptors ?? []
        ),
        ...metadata.interceptors,
        ...subscribeEventMetadata.interceptors,
      ];
      const identifier = subscribeEventMetadata.identifier;
      this.subscriptions.push(this.eventBus.subscribe(identifier, async (payload) => {
        if (!subscribeEventMetadata.filter(payload)) {
          return;
        }
        const childContainer = this.container.createChild();
        childContainer.bind(Container).toConstantValue(childContainer);
        const composedInterceptorConstructor = composeRequestInterceptor(childContainer, interceptors);
        const context = new EventSubscriptionContext(childContainer, identifier, payload);
        const composedInterceptor = childContainer.get(composedInterceptorConstructor);
        childContainer.bind<unknown>(subscribeEventMetadata.identifier).toConstantValue(payload);

        return composedInterceptor.intercept(context, () => {
          const target = childContainer.get<object>(constructor);
          const targetMethod = subscribeEventMetadata.prototype[subscribeEventMetadata.name];
          return Promise.resolve(invokeMethod(childContainer, target, targetMethod));
        });
      }));
    }
  }

  return EventSubscriptionModule;
}

