import {
  createEventSubscriptionModule,
  EventAnnouncer,
  InjectEventAnnouncer,
  SubscribeEvent,
  SubscribeEventController,
} from '../src/event';
import {Inject, ModuleClass, OnModuleCreate, ProcessManager} from '../src';
import {ApplicationRunner} from '../src/entry-point';
import {Subject} from 'rxjs';

describe('Event subscribe and announce', () => {

  test('Subscribe', async () => {


    @SubscribeEventController()
    class SubscribeController {

      @SubscribeEvent('event')
      foo(@Inject('event') event: number, @Inject(ProcessManager) pm: ProcessManager) {
        pm.shutdown();
      }
    }

    @ModuleClass({
      requires: [
        createEventSubscriptionModule({
          components: [SubscribeController],
        }),
      ],
    })
    class EntryModule {

      @OnModuleCreate()
      onModuleCreate(@InjectEventAnnouncer('event') announcer: EventAnnouncer<number>) {
        return announcer(111);
      }
    }

    const subject = new Subject();
    await ApplicationRunner.runModule(EntryModule, {onExit: () => subject.complete() as never});
    return subject.toPromise();
  });
});
