import {
  createEventSubscriptionModule,
  EventAnnouncer,
  EventPublisher,
  EventSubscriptionContext,
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
    const spy3 = jest.fn();

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

      @SubscribeEvent('channel')
      channel(@Inject('a') a: any, @Inject('b') b: any) {
        spy3(a, b);
      }
    }

    class MockInterceptor extends RequestInterceptor<EventSubscriptionContext> {
      intercept(context: EventSubscriptionContext, next: () => Promise<void>): Promise<void> {
        expect(context.targetConstructor).toBe(SubscribeController);
        expect(typeof context.targetMethodKey).toBe('string');
        return next();
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
      async onModuleCreate(
        @InjectEventAnnouncer() announcer: EventAnnouncer,
        @InjectEventAnnouncer('event') eventAnnouncer: (value: any) => void,
        @Inject(EventPublisher) eventPublisher: EventPublisher,
      ) {
        await announcer.announceEvent('event', 'foo');
        expect(spy).not.toHaveBeenCalled();
        expect(spy2).toHaveBeenCalledWith('foo');
        await announcer.announceEvent({
          channel: 'event',
          symbol: 'event',
          payload: 'bar',
        });
        await announcer.bind('a', 1).bind('b', 2).announce('channel');
        await eventPublisher.prepare('channel').bind('a', 2).bind('b', 1).publish();
        expect(spy).toHaveBeenCalledWith('bar');
        expect(spy2).toHaveBeenLastCalledWith('bar');
        expect(spy3).toHaveBeenNthCalledWith(1, 1, 2);
        expect(spy3).toHaveBeenNthCalledWith(2, 2, 1);
      }
    }

    await ModuleRoot.run(EntryModule, 'onModuleCreate');
  });
});
