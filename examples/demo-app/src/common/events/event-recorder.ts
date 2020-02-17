import {Constructor} from '@sensejs/utility';

export type EventRecordingMethod<Payload extends {}> = (...args: any[]) => (void | Payload | undefined);

export class EventRecorder<Payload extends {}, Record extends {}, Entity extends {}> {

  static from<Payload, Record, Entity extends {}>(
    recordEntityConstructor: Constructor,
    recorder: (payload: Payload[], entity: Entity) => Record,
  ) {
    return new EventRecorder(recordEntityConstructor, recorder);
  }

  readonly entityEventStore = new WeakMap<Entity, Payload[]>();

  private constructor(
    readonly recordConstructor: Constructor<Record>,
    readonly recorder: (payload: Payload[], entity: Entity) => Record,
  ) {}

  createEventRecord(entity: Entity) {
    const payloads = this.entityEventStore.get(entity);
    if (payloads) {
      return this.recorder(payloads, entity);
    }
  }
}
