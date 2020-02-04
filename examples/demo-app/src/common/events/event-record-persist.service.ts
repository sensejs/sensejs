import {EntityManager} from 'typeorm';
import {EventBroadcaster} from './event-support';

export class EventRecordPersistenceService {

  static weakMap = new WeakMap<EntityManager, EventBroadcaster>();
}
