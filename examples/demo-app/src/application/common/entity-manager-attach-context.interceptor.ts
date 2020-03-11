import {Inject, InjectLogger, Logger, RequestInterceptor, RequestContext} from '@sensejs/core';
import {EntityManager} from 'typeorm';
import {EventAnnounceService} from '../../infrastructure/event/event-announce.service';
import {attachLoggerToEntityManager} from '@sensejs/typeorm';

export class EntityManagerAttachContextInterceptor extends RequestInterceptor {

  constructor(
    @Inject(EntityManager) private entityManager: EntityManager,
    @Inject(EventAnnounceService) private eventAnnounceService: EventAnnounceService,
    @InjectLogger('TypeOrmQuery') private queryLogger: Logger,
  ) {
    super();
  }

  intercept(context: RequestContext, next: () => Promise<void>): Promise<void> {
    attachLoggerToEntityManager(this.entityManager, this.queryLogger);
    EventAnnounceService.map.set(this.entityManager, this.eventAnnounceService);
    return next();
  }


}

