import {jest} from '@jest/globals';
import {
  createEventSubscriptionModule,
  EventPublisher,
  EventSubscriptionContext,
  Inject,
  Module,
  EntryModule,
  ProcessManager,
  SubscribeEvent,
  SubscribeEventController,
} from '../src/index.js';
import {Middleware} from '@sensejs/container';

describe('Event subscribe and announce', () => {
  test('Subscribe', async () => {
    const spy = jest.fn();
    const spy2 = jest.fn();
    const spy3 = jest.fn();
    const filterSpy = jest.fn();

    // This one keeps legacy format for compatibility test
    @Middleware()
    class MockMiddleware {
      constructor(@Inject(EventSubscriptionContext) readonly context: EventSubscriptionContext) {}

      handle(next: () => Promise<void>): Promise<void> {
        expect(this.context.targetConstructor).toBe(SubscribeController);
        expect(typeof this.context.targetMethodKey).toBe('string');
        return next();
      }
    }

    @Middleware({
      provides: ['a', 'b'],
    })
    class MockChannelMiddleware {
      constructor(@Inject(EventSubscriptionContext) readonly context: EventSubscriptionContext) {}

      handle(next: (a: any, b: any) => Promise<void>): Promise<void> {
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
        middlewares: [MockChannelMiddleware],
      })
      channel(@Inject('a') a: any, @Inject('b') b: any) {
        spy3(a, b);
      }
    }

    @Module({
      requires: [
        createEventSubscriptionModule({
          middlewares: [MockMiddleware],
          components: [SubscribeController],
        }),
      ],
    })
    class TestEntry {
      async main(@Inject(EventPublisher) eventPublisher: EventPublisher, @Inject(ProcessManager) pm: ProcessManager) {
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
        pm.shutdown();
      }
    }

    await EntryModule.start(TestEntry, 'main');
  });
});
