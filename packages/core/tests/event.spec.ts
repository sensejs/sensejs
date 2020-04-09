import {
  createEventSubscriptionModule,
  EventAnnouncer,
  EventChannelAnnouncer,
  Inject,
  InjectEventAnnouncer,
  ModuleClass,
  OnModuleCreate,
  ProcessManager, RequestContext, RequestInterceptor,
  SubscribeEvent,
  SubscribeEventController,
} from '../src';
import {ApplicationRunner} from '../src/entry-point';
import {Subject} from 'rxjs';

describe('Event subscribe and announce', () => {

  test('Subscribe', async () => {

    const spy = jest.fn();

    class MockInterceptor extends RequestInterceptor {
      intercept(context: RequestContext, next: () => Promise<void>): Promise<void> {
        return next();
      }
    }

    @SubscribeEventController()
    class SubscribeController {

      @SubscribeEvent('event')
      foo(@Inject('event') event: string, @Inject(ProcessManager) pm: ProcessManager) {
        pm.shutdown();
      }

      @SubscribeEvent('event2')
      bar(@Inject('event2') param: string) {
        spy(param);
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

      @OnModuleCreate()
      async onModuleCreate(
        @InjectEventAnnouncer('event') announcer: EventChannelAnnouncer<string>,
        @InjectEventAnnouncer() announcer2: EventAnnouncer,
      ) {
        await announcer2.announceEvent('event2', 'bar');
        expect(spy).toHaveBeenCalledWith('bar');
        await announcer('foo');
      }
    }

    const subject = new Subject();
    await ApplicationRunner.runModule(EntryModule, {
      onExit: (exitCode) => {
        expect(exitCode).toBe(0);
        return subject.complete() as never;
      },
    });
    return subject.toPromise();
  });
});
