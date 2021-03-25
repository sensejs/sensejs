import {
  createEventSubscriptionModule,
  EventPublisher,
  EventSubscriptionContext,
  Inject,
  ModuleClass,
  ModuleRoot,
  RequestInterceptor,
  SubscribeEvent,
  SubscribeEventController,
} from '../src';

describe('Event subscribe and announce', () => {
  test('Subscribe', async () => {
    const spy = jest.fn();
    const spy2 = jest.fn();
    const spy3 = jest.fn();
    const filterSpy = jest.fn();

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

      @SubscribeEvent('channel', {
        filter: (x) => {
          filterSpy(x);
          return true;
        },
      })
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
        @Inject(EventPublisher) eventPublisher: EventPublisher,
      ) {
        await eventPublisher.prepare('event').publish('event', 'bar');
        await eventPublisher.prepare('channel').bind('a', 1).bind('b', 2).publish();
        await eventPublisher.prepare('channel').bind('a', 2).bind('b', 1).publish('channel', 'payload');
        expect(spy).toHaveBeenCalledWith('bar');
        expect(spy2).toHaveBeenLastCalledWith('bar');
        expect(filterSpy).toHaveBeenNthCalledWith(1, undefined);
        expect(filterSpy).toHaveBeenNthCalledWith(2, 'payload');
        expect(spy3).toHaveBeenNthCalledWith(2, 2, 1);

        filterSpy.mockImplementationOnce(() => {
          throw new Error();
        });
        await expect(() => eventPublisher.prepare('channel').bind('a', 2).bind('b', 1).publish('channel', 'payload'))
          .rejects;
      }
    }

    await ModuleRoot.run(EntryModule, 'onModuleCreate');
  });
});

