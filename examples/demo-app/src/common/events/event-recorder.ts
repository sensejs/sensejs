import {Constructor} from '@sensejs/utility';

export type EventRecordingMethod<Payload> = (...args: any[]) => (void | Payload | undefined);

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
