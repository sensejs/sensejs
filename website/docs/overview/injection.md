---
id: injection
sidebar_position: 2
---

# Injection

SenseJS framework provides a decorator based inject solution, which shall looks like many other frameworks.

Based on the demo in the [last article](./hello-world.md), we add a new component `Timer` to the app to show
how injection works.


## Declaring a new Component

```typescript
import {Component, ComponentScope} from '@sensejs/core';

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

```

This component will return the duration since application start up, or the time it's reset. Note that this component
is marked as singleton, it'll be ensured that only one instance will be created by the IoC container of SenseJS (of
course, that does not prevent your from instantiate it manually).

In addition to `SINGLETON`, a component can also be marked as `REQUEST` or `TRANSIENT` (which is the default).

To make `Timer` injectable, it's necessary to list it in `components` of a module.

```typescript
const TimerModule = createModule({
    components: [Timer]
});
```




## Using the `Timer` Component

The instance of `Timer` can be injected as a parameter to any class that instantiated by SenseJS. It can also
be injected to method of class when the method is invoked by SenseJS.

### Inject to the `HelloWorldController`

We'll modify the `HelloWorldController` to log each time the `helloWorld` method is invoked, and a new method `reset` that
will reset the timer will be added.

```typescript

@Controller('/')
class HelloWorldController {

  constructor(@Inject(Timer) private timer: Timer) {}

  @GET('/')
  helloWorld() {
    console.log(`Received request at ${this.timer.getDuration()} milliseconds`);
    return 'hello world';
  }

  @POST('/reset')
  reset() {
    this.timer.reset();
  }
}
```

### Inject to Lifecycle hooks of module

We can also log the duration when application is shutdown, by add a shutdown hook to `HelloWorldApp`.

```typescript
@EntryPoint()
@ModuleClass({
  requires: [
    createHttpModule({
      requires: [TimerModule],
      components: [
        HelloWorldController,
      ],
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

```

Be noticed that `TimerModule` is added to `requires` property of param for creating the http module, without this the
injection is impossible.

### Running

You can run this app and send request to invoke `helloWorld` and `reset` to verify the behaviour is expected.

You may see output like

```
% ts-node src/index.ts
service started
Received request at 0 milliseconds
Received request at 4055 milliseconds
```

Note that the line `Received request at 0 milliseconds` indicates that the instance of `Timer` is lazily created when
the first time it's required to be instantiated.

## More ways to define injectable

In addition to adding decorated constructor to a module, you can also declare constants or value produced by a factory
as injectable.

### Constants

The following example archives almost the same goal by providing `Timer` as a constant, except that the `Timer`
instance will be created immediately when the source file is loaded. Also note that constant injectables are always
in `SINGLETON` scope.

```typescript
const TimerModule = createModule({
    constants: [{
        // This can also be a string or a symbol, but you need to change corresponding param to `Inject` decorator
        provide: Timer,
        value: new Timer()
    }]
});
```


### Factories

You can also define injectable through factories. The following example will archive same goal by providing `Timer`
instance through a factory.

```typescript
class TimerFactory extends ComponentFactory<Timer> {
    build() {
        return new Timer();
    }
}


const TimerModule = createModule({
    factories: [{
        provide: Timer,
        scope: ComponentScope.SINGLETON,
        factory: TimerFactory
    }]
});
```






