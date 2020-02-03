import {Constructor, DecoratorBuilder} from '@sensejs/utility';
import {Class} from '@sensejs/core';

const ENTITY_EVENT_RECORD_METADATA = Symbol();

interface EventRecordMetadata<Payload, Record, Entity> {
  sourceConstructor: Class;
  recorder: EventRecorder<Payload, Record, Entity>;
}

interface EventRecordedMethod<Payload> {
  (...args: unknown[]): (void | Payload | (Payload[]));
}

export class EventRecorder<Payload, Record, Entity> {

  static from<Payload, Record, Entity>(
    recordEntityConstructor: Constructor,
    recorder: (payload: Payload, entity: Entity) => Record,
  ) {
    return new EventRecorder(recordEntityConstructor, recorder);
  }

  readonly entityEventStore = new WeakMap<object, Payload[]>();

  private constructor(
    readonly recordEntityConstructor: Constructor,
    readonly recorder: (payload: Payload, entity: Entity) => Record,
  ) {}
}

export interface EnableEventRecordDecorator<Payload, Entity = {}> {
  /**
   * When apply to instance method, its return value can be recorded by
   * event recorder
   *
   * @decorator
   * @param prototype
   * @param name
   * @param descriptor
   * @note The constructor also need to be decorated to enable event recording
   *
   */<F extends EventRecordedMethod<Payload>>(
    prototype: Entity,
    name: string | symbol,
    descriptor: TypedPropertyDescriptor<F>,
  ): TypedPropertyDescriptor<F>;

  /**
   * When apply to constructor, event recording is enabled on its instance
   * @decorator
   * @param constructor
   */
  (constructor: Constructor<Entity>): void;
}

export function EnableEventRecord<Payload, Record, Entity>(domainEvent: EventRecorder<Payload, Record, Entity>) {
  return new DecoratorBuilder(EnableEventRecord.name)
    .whenApplyToConstructor((constructor: Class) => {
      const metadata: EventRecordMetadata<Payload, Record, Entity> = {
        sourceConstructor: constructor,
        // recordConstructor: domainEvent.recordEntityConstructor,
        recorder: domainEvent,
      };
      Reflect.defineMetadata(ENTITY_EVENT_RECORD_METADATA, metadata, constructor);
    })
    .whenApplyToInstanceMethod((prototype, name, descriptor) => {
      descriptor.value = new Proxy(descriptor.value!, {
        apply: (target, thisArg, argArray) => {
          const result = target.apply(thisArg, argArray);
          if (typeof result !== 'undefined') {
            const allEvents = domainEvent.entityEventStore.get(thisArg) ?? [];
            domainEvent.entityEventStore.set(thisArg, allEvents.concat(result));
            return result;
          }
        },
      });
      return descriptor;
    })
    .build<EnableEventRecordDecorator<Payload, Entity>>();
}
