import 'reflect-metadata';
import {createHttpModule, Controller, GET} from '@sensejs/http-koa-platform';
import {
  EntryPoint,
  ModuleClass,
  OnModuleCreate,
  Component,
  ComponentScope,
  createModule,
  Inject,
  OnModuleDestroy,
} from '@sensejs/core';

@Component({scope: ComponentScope.SINGLETON})
class Timer {
  private timestamp = Date.now();

  reset() {
    this.timestamp = Date.now();
  }

  getDuration() {
    return Date.now() - this.timestamp;
  }
}
const TimerModule = createModule({
  components: [Timer],
});

@Controller('/')
class HelloWorldController {
  constructor(@Inject(Timer) private timer: Timer) {}

  @GET('/')
  helloWorld() {
    console.log(`Received request at ${this.timer.getDuration()} milliseconds`);
    return 'hello world';
  }
}

@EntryPoint()
@ModuleClass({
  requires: [
    createHttpModule({
      requires: [TimerModule],
      components: [HelloWorldController],
      httpOption: {
        listenAddress: 'localhost',
        listenPort: 8080,
      },
    }),
  ],
})
class HelloWorldApp {
  @OnModuleCreate()
  onModuleCreate() {
    console.log('service started');
  }

  @OnModuleDestroy()
  onModuleDestroy(@Inject(Timer) timeMeasure: Timer) {
    console.log(`service stopped at ${timeMeasure.getDuration()} milliseconds`);
  }
}
