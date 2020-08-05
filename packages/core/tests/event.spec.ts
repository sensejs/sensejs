import {
  createEventSubscriptionModule,
  EventAnnouncer,
  Inject,
  InjectEventAnnouncer,
  ModuleClass,
  ModuleRoot,
  RequestContext,
  RequestInterceptor,
  SubscribeEvent,
  SubscribeEventController,
} from '../src';

describe('Event subscribe and announce', () => {
  test('Subscribe', async () => {
    const spy = jest.fn();
    const spy2 = jest.fn();

    class MockInterceptor extends RequestInterceptor {
      intercept(context: RequestContext, next: () => Promise<void>): Promise<void> {
        return next();
      }
    }

    @SubscribeEventController()
    class SubscribeController {
      @SubscribeEvent('event', {filter: (payload: string) => payload === 'bar'})
      bar(@Inject('event') param: string) {
        spy(param);
      }

      @SubscribeEvent('event')
      bar2(@Inject('event') param: string) {
        spy2(param);
      }
    }

    @ModuleClass({
      requires: [
        createEventSubscriptionModule({
          interceptors: [MockInterceptor],
          components: [SubscribeController],
        }),
      ],
    })
    class EntryModule {
      async onModuleCreate(@InjectEventAnnouncer() announcer: EventAnnouncer) {
        await announcer.announceEvent('event', 'foo');
        expect(spy).not.toHaveBeenCalled();
        expect(spy2).toHaveBeenCalledWith('foo');
        await announcer.announceEvent({
          channel: 'event',
          symbol: 'event',
          payload: 'bar',
        });
        expect(spy).toHaveBeenCalledWith('bar');
        expect(spy2).toHaveBeenLastCalledWith('bar');
      }
    }

    await ModuleRoot.run(EntryModule, 'onModuleCreate');
  });
});
