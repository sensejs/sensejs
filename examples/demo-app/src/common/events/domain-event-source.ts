import {Constructor} from '@sensejs/utility';

const EVENT_RECORD_ENTITY_METADATA = Symbol();

interface DomainEventMetadata<Payload> {
  sourceConstructor: Constructor;
  recordConstructor: EventRecordConstructor<Payload>;
  domainEvent: DomainEvent<Payload>;
}

interface EventSourceMethod<Payload> {
  (...args: unknown[]): (void | Payload | (Payload[]));
}

interface EventRecordConstructor<Payload> {
  new(payload: Payload[]): {};
}

export class DomainEvent<Payload> {

  readonly entityEventStore = new WeakMap<object, Payload[]>();

  constructor(readonly recordEntityConstructor: EventRecordConstructor<Payload>) {}

}

export function EventSourceMethod<Payload>(domainEvent: DomainEvent<Payload>) {
  return <F extends EventSourceMethod<Payload>>(
    prototype: object,
    name: string | symbol,
    descriptor: TypedPropertyDescriptor<F>,
  ): TypedPropertyDescriptor<F> => {
    descriptor.value = new Proxy(descriptor.value!, {
      apply: (target: F, thisArg: object, argArray: unknown[]) => {
        const result = target.apply(thisArg, argArray);
        if (typeof result !== 'undefined') {
          const allEvents = domainEvent.entityEventStore.get(thisArg) ?? [];
          domainEvent.entityEventStore.set(thisArg, allEvents.concat(result));
          return result;
        }
      },
    });
    return descriptor;
  };
}

export function EventSource<Payload>(domainEvent: DomainEvent<Payload>) {
  return (constructor: Constructor) => {
    const metadata: DomainEventMetadata<Payload> = {
      sourceConstructor: constructor,
      recordConstructor: domainEvent.recordEntityConstructor,
      domainEvent,
    };
    Reflect.defineMetadata(EVENT_RECORD_ENTITY_METADATA, metadata, constructor);
  };
}

export function getEntityEvent<Payload, Entity extends {}>(entity: Entity, constructor: Constructor<Entity>) {
  const metadata = Reflect.getMetadata(EVENT_RECORD_ENTITY_METADATA, constructor);
  if (typeof metadata !== 'undefined') {
    (
      metadata as DomainEventMetadata<Payload>
    ).domainEvent.entityEventStore.get(entity);
  }
}
