import {Constructor, DecoratorBuilder} from '@sensejs/utility';
import {Class} from '@sensejs/core';
import {EventRecorder, EventRecordingMethod} from './event-recorder';

const ENTITY_EVENT_RECORD_METADATA = Symbol();

export interface EventRecordingMetadata<Payload extends {}, Record extends {}, Entity extends {}> {
  sourceConstructor: Class;
  recorder: EventRecorder<Payload, Record, Entity>;
}

export interface EventRecordingDecorator<Payload, Entity = {}> {
  /*
   * When apply to instance method, its return value can be recorded by
   * event recorder
   *
   * @decorator
   * @param prototype
   * @param name
   * @param descriptor
   * @note The constructor also need to be decorated to enable event recording
   *
   */
  <F extends EventRecordingMethod<Payload>>(
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

export function EventRecording<Payload, Record, Entity>(recorder: EventRecorder<Payload, Record, Entity>) {
  return new DecoratorBuilder(EventRecording.name)
    .whenApplyToConstructor((constructor: Class) => {
      const metadata: EventRecordingMetadata<Payload, Record, Entity> = {
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
    .build<EventRecordingDecorator<Payload, Entity>>();
}

export function getEventRecordingMetadata(constructor: any): EventRecordingMetadata<{}, {}, {}> {
  return Reflect.getMetadata(ENTITY_EVENT_RECORD_METADATA, constructor);
}
