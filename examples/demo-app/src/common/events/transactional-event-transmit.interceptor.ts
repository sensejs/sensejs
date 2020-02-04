import {Inject, InjectLogger, Logger, RequestContext, RequestInterceptor} from '@sensejs/core';
import {EventBroadcaster, TransactionEventBroadcaster} from './event-support';
import {EntityManager} from 'typeorm';
import {EventRecordPersistenceService} from './event-record-persist.service';

export class TransactionalEventTransmitInterceptor extends RequestInterceptor {
  constructor(
    @InjectLogger() private logger: Logger,
    @Inject(EventBroadcaster) private eventBus: EventBroadcaster,
    @Inject(TransactionEventBroadcaster) private transactionalEventBus: TransactionEventBroadcaster,
    @Inject(EntityManager) private entityManager: EntityManager,
  ) {
    super();
  }

  async intercept(context: RequestContext, next: () => Promise<void>) {
    context.bindContextValue(EventBroadcaster, this.transactionalEventBus);
    await this.entityManager.transaction(async (entityManager) => {
      context.bindContextValue(EntityManager, entityManager);
      EventRecordPersistenceService.weakMap.set(entityManager, this.transactionalEventBus);
      await next();
    });
    await Promise.all(
      Array
        .from(this.transactionalEventBus.announcers.entries())
        .map(async ([recordConstructor, transmitter]) => {
          try {
            await transmitter.flush();
            const repository = this.entityManager.getRepository(recordConstructor);
          } catch (e) {
            this.logger.error('Failed to mark event record %s as published', recordConstructor.name);
            this.logger.error('Stacktrace:\n', e);
          }
        }));
  }

}
