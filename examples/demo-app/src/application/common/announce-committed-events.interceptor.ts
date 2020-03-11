import {Inject, RequestContext, RequestInterceptor} from '@sensejs/core';
import {TransactionEventAnnounceService} from '../../infrastructure/event/transaction-event-announce.service';
import {EventAnnounceService} from '../../infrastructure/event/event-announce.service';

export class AnnounceCommittedEventsInterceptor extends RequestInterceptor {
  constructor(@Inject(EventAnnounceService) private eventAnnounceService: EventAnnounceService) {
    super();
  }

  async intercept(context: RequestContext, next: () => Promise<void>) {
    const contextualEventAnnounceService = new TransactionEventAnnounceService(this.eventAnnounceService);
    context.bindContextValue(EventAnnounceService, contextualEventAnnounceService);
    await next();
    contextualEventAnnounceService.commit();
  }
}
