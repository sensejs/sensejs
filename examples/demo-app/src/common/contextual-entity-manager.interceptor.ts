import {Inject, RequestContext, RequestInterceptor} from '@sensejs/core';
import {EntityManager} from 'typeorm';

export class ContextualEntityManagerInterceptor extends RequestInterceptor {

  static contextMap: WeakMap<EntityManager, RequestContext> = new WeakMap();

  constructor(@Inject(EntityManager) private entityManager: EntityManager) {
    super();
  }

  async intercept(context: RequestContext, next: () => Promise<void>): Promise<void> {
    ContextualEntityManagerInterceptor.contextMap.set(this.entityManager, context);
    return next();
  }
}
