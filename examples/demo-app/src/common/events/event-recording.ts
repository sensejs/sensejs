import {Constructor, DecoratorBuilder} from '@sensejs/utility';
import {Class} from '@sensejs/core';

const ENTITY_EVENT_RECORD_METADATA = Symbol();

interface EventRecordMetadata<Payload, Record, Entity> {
  sourceConstructor: Class;
  recorder: EventRecorder<Payload, Record, Entity>;
}

export type EventRecordedMethod<Payload> = (...args: any[]) => (void | Payload | undefined);

export class EventRecorder<Payload, Record, Entity extends {}> {

  static from<Payload, Record, Entity extends {}>(
    recordEntityConstructor: Constructor,
    recorder: (payload: Payload, entity: Entity) => Record,
  ) {
    return new EventRecorder(recordEntityConstructor, recorder);
  }

  readonly entityEventStore = new WeakMap<Entity, Payload[]>();

  private constructor(
    readonly recordConstructor: Constructor<Record>,
    readonly recorder: (payload: Payload, entity: Entity) => Record,
  ) {}

  getRecordedEvent(entity: Entity) {
    return this.entityEventStore.get(entity) ?? [];
  }
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
  ): void;

  /**
   * When apply to constructor, event recording is enabled on its instance
   * @decorator
   * @param constructor
   */
  (constructor: Constructor<Entity>): void;
}

export function EnableEventRecord<Payload, Record, Entity>(recorder: EventRecorder<Payload, Record, Entity>) {
  return new DecoratorBuilder(EnableEventRecord.name)
    .whenApplyToConstructor((constructor: Class) => {
      const metadata: EventRecordMetadata<Payload, Record, Entity> = {
        sourceConstructor: constructor,
        recorder,
      };
      Reflect.defineMetadata(ENTITY_EVENT_RECORD_METADATA, metadata, constructor);
    })
    .whenApplyToInstanceMethod((prototype, name, descriptor) => {
      descriptor.value = new Proxy(descriptor.value!, {
        apply: (target, thisArg, argArray) => {
          const result = target.apply(thisArg, argArray);
          if (typeof result !== 'undefined') {
            const allEvents = recorder.entityEventStore.get(thisArg) ?? [];
            recorder.entityEventStore.set(thisArg, allEvents.concat(result));
            return result;
          }
        },
      });
      return descriptor;
    })
    .build<EnableEventRecordDecorator<Payload, Entity>>();
}
