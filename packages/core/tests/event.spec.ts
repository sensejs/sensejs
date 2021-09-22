import {jest} from '@jest/globals';
import {
  createEventSubscriptionModule,
  EventPublisher,
  EventSubscriptionContext,
  Inject,
  ModuleClass,
  ModuleRoot,
  SubscribeEvent,
  SubscribeEventController,
} from '../src';
import {InterceptProviderClass} from '@sensejs/container';

describe('Event subscribe and announce', () => {
  test('Subscribe', async () => {
    const spy = jest.fn();
    const spy2 = jest.fn();
    const spy3 = jest.fn();
    const filterSpy = jest.fn();
    @InterceptProviderClass()
    class MockInterceptor {
      constructor(@Inject(EventSubscriptionContext) readonly context: EventSubscriptionContext) {}

      intercept(next: () => Promise<void>): Promise<void> {
        expect(this.context.targetConstructor).toBe(SubscribeController);
        expect(typeof this.context.targetMethodKey).toBe('string');
        return next();
      }
    }

    @InterceptProviderClass('a', 'b')
    class MockChannelInterceptor {
      constructor(@Inject(EventSubscriptionContext) readonly context: EventSubscriptionContext) {}

      intercept(next: (a: any, b: any) => Promise<void>): Promise<void> {
        expect(this.context.targetConstructor).toBe(SubscribeController);
        expect(typeof this.context.targetMethodKey).toBe('string');
        return next(this.context.payload.a, this.context.payload.b);
      }
    }

    @SubscribeEventController()
    class SubscribeController {
      @SubscribeEvent('event', {filter: (payload: string) => payload === 'bar'})
      bar(@Inject(EventSubscriptionContext) param: EventSubscriptionContext) {
        spy(param.payload);
      }

      @SubscribeEvent('event')
      bar2(@Inject(EventSubscriptionContext) param: EventSubscriptionContext) {
        spy2(param.payload);
      }

      @SubscribeEvent('channel', {
        filter: (x) => {
          filterSpy(x);
          return true;
        },
        interceptProviders: [MockChannelInterceptor],
      })
      channel(@Inject('a') a: any, @Inject('b') b: any) {
        spy3(a, b);
      }
    }

    @ModuleClass({
      requires: [
        createEventSubscriptionModule({
          interceptProviders: [MockInterceptor],
          components: [SubscribeController],
        }),
      ],
    })
    class EntryModule {
      async onModuleCreate(@Inject(EventPublisher) eventPublisher: EventPublisher) {
        await eventPublisher.publish('event', 'bar');
        await eventPublisher.publish('channel', {
          a: 1,
          b: 2,
          data: 'payload',
        });
        await eventPublisher.publish('channel', {
          a: 2,
          b: 1,
        });
        expect(spy).toHaveBeenCalledWith('bar');
        expect(spy2).toHaveBeenLastCalledWith('bar');
        expect(spy3).toHaveBeenNthCalledWith(1, 1, 2);
        expect(spy3).toHaveBeenNthCalledWith(2, 2, 1);

        filterSpy.mockImplementationOnce(() => {
          throw new Error();
        });
        await expect(() =>
          eventPublisher.publish('publish', {
            a: 2,
            b: 1,
          }),
        ).rejects;
      }
    }

    await ModuleRoot.run(EntryModule, 'onModuleCreate');
  });
});
