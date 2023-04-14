---
id: injection
sidebar_position: 3
---

# Injection

SenseJS framework provides an advanced injection framework, which features

-  Constructor parameters injection, which is exactly what your expected for a common IoC framework

-  Middleware provided injectable support, which is the most powerful and elegant part of SenseJs. In this article,
   we'll show you that it's very useful when combining with a traceable logger.

-  Method parameters injection, based on which the `@sensejs/http` and `@sensejs/kafka` handle requests and messages,
   and such ability can also be useful when you're integrating some protocol other than HTTP and Kafka.

## Example

We'll show you all the powerful features in an example.

The code of ths example can be found at the directory [./examples/injection](
https://github.com/sensejs/sensejs/tree/master/examples/injection) in the [SenseJs repository].

This example we separate the code into three parts.

-  `random-number.ts`: contains a simple component `RandomNumberGenerator` and a controller `RandomNumberController` for querying or mutating the state
   of `RandomNumberGenerator`, and exporting it as a module `RandomNumberModule`.

-  `http.ts`: containing the code for setting up an HTTP server, including all middleware


### `RandomNumberModule`

This section we focused on file `random-number.module.ts`

```typescript
@Component()
@Scope(Scope.SINGLETON)
class RandomNumberGenerator {

  private state: number = Date.now() >>> 0; // Truncate the value of Date.now() into a 32-bit integer

  reseed(seed: number) {
    this.state = seed >>>= 0;
    return this.state;
  }

  query() {
    return this.state;
  }

  next() {
    this.state = (this.state * 64829 + 0x5555) >>> 0;
    return this.state;
  }
}
```

In addition to `@Component()`, it's also decorated with `@Scope(Scope.SINGLETON)` as we want to ensure that there is
only one instance of `RandomNumberGenerator` exists.

In addition to the `SINGLETON` scope, a component can also be marked as`REQUEST` scope or `TRANSIENT` scope (which is
the default). The differences between them are explained below:

- `SINGLETON`: Only instantiated once during the application lifetime.
- `REQUEST`: Only instantiated once each time when the IoC Container is requested to instantiate it or its dependents.
- `TRANSIENT`:  Create instances each time for each param that needs such a component.

Then we define the controller `RandomNumberController`

```typescript

@Controller('/')
class RandomNumberController {

  constructor(@Inject(RandomNumberGenerator) private generator: RandomNumberGenerator,
              @InjectLogger() private logger: Logger) {}

  @GET('/')
  async get() {
    const state = this.generator.query();
    return {state};
  }

  @POST('/next')
  async next() {
    const value = this.generator.query();
    return {value};
  }

  @POST('/seed')
  async seed(@Body('seed') seed: any) {
    const state = Number(seed);
    if (!Number.isInteger(state)) {
      this.logger.warn('Invalid seed %s', seed);
    }
    this.generator.reseed(state);
     return {state}
  }
}

```
The above code provides an HTTP interface to query or mutate the state of `RandomNumberGenerator`.

When handling `POST /seed`, the `seed` field in post body is injected as the parameter, and you can inject any valid
injectable to method parameters just like constructor parameter injection. They acts differently only when the
controller is declared in singleton scope, while method parameter injection always happens on request scope.

Also note that `@InjectLogger()` is actually injecting a `LoggerBuilder` and transformed to a logger. We'll later
override `LoggerBuilder` in a middleware in this example

Finally, we package them into a module and export it.

```typescript

export const RandomNumberModule = createModule({
  components: [RandomNumberGenerator, RandomNumberController]
});
```

### Handling and intercepting an HTTP request

In this section we focused on another file `./src/http.ts`.

As mentioned above, we'll show you how middleware works in this example.

First we intercept all requests and assign each of them with a request id

```typescript
import {randomUUID} from 'crypto';

const REQUEST_ID = Symbol('REQUEST_ID');

@Middleware({
  provides: [REQUEST_ID]
})
class RequestIdMiddleware {

  async intercept(next: (requestId: string) => Promise<void>) {
    const requestId = randomUUID();
    await next(requestId);
  }
}
```

And then we'll attach the request id to a traceable logger,

```typescript

@Middleware({
  provides: [LoggerBuilder]
})
class ContextualLoggingMiddleware {

  constructor(
    // It'll be injected with value provided by previous interceptor
    @Inject(REQUEST_ID) private requestId: string,
    // It'll be injected with globally defined LoggerBuilder
    @InjectLogger() private logger: Logger
  ) {}

  async intercept(next: (lb: LoggerBuilder) => Promise<void>) {
    this.logger.debug('Associate LoggerBuilder with requestId=%s', this.requestId);
    const slb = defaultLoggerBuilder.setTraceId(this.requestId);
    await next(slb);
  }

}

```

And finally we combine the dependencies and the above interceptors to create an HTTP module and export it.
```typescript
export const HttpModule = createKoaHttpModule({
  // We need list RandomNumberModule here, so that RandomNumberController can be discovered
  requires: [SenseLogModule, RandomNumberModule],

  // The order must not be changed, since REQUEST_ID is not a valid injetable before RequestIdMiddleware
  middlewares: [
    RequestIdMiddleware,
    ContextualLoggingMiddleware
  ],

  httpOption: {
    listenAddress: 'localhost',
    listenPort: 8080,
  },
});

```

### Entrypoint

Before create a module and mark it as entry point, we need to import `"reflect-metadat"` at first place.

```typescript
import 'reflect-metadata';
import {EntryPoint, ModuleClass} from '@sensejs/core';
import {HttpModule} from './http.js';

@EntryPoint()
@ModuleClass({
  requires: [
    HttpModule
  ],
})
class App {
}

```


## Running

You can run this app and send request with curl, you'll see output like this

```
% curl http://localhost:8080/state
{"state":4005820056}

% curl http://localhost:8080/next -XPOST
{"value":2405846925}

% curl http://localhost:8080/next -XPOST
{"value":1207935726}

% curl http://localhost:8080/reseed -d 'seed=1111'
{"state":1111}

% curl http://localhost:8080/reseed -d 'seed=invalid'
{"state":1111}

curl http://localhost:8080/next -XPOST
{"value":72046864}

```
On the application log, you'll see something like

```
+ 16:51:05.494 ContextualLoggingMiddleware - | Associate LoggerBuilder with requestId=25c469ea-2c9f-4ade-9d1f-a2603e509402
+ 16:51:09.609 ContextualLoggingMiddleware - | Associate LoggerBuilder with requestId=19ad7258-08b6-4fec-8d0b-042067fa5bf8
+ 16:51:09.609 RandomNumberController 19ad7258-08b6-4fec-8d0b-042067fa5bf8 | Generated random number:  2405846925
+ 16:51:11.922 ContextualLoggingMiddleware - | Associate LoggerBuilder with requestId=9b9c909b-ba79-48f2-8fa4-febd39dc781f
+ 16:51:11.923 RandomNumberController 9b9c909b-ba79-48f2-8fa4-febd39dc781f | Generated random number:  1207935726
+ 16:51:16.972 ContextualLoggingMiddleware - | Associate LoggerBuilder with requestId=fa3c6df8-ccca-48d4-85ba-88520ca98986
+ 16:51:20.076 ContextualLoggingMiddleware - | Associate LoggerBuilder with requestId=7d840e09-f95d-48e2-b398-e60cf192e801
+ 16:51:20.077 RandomNumberController 7d840e09-f95d-48e2-b398-e60cf192e801 | Invalid seed NaN, ignored
+ 16:51:22.194 ContextualLoggingMiddleware - | Associate LoggerBuilder with requestId=67ce037b-5d64-4a16-a57d-fba78ceed8f8
+ 16:51:22.194 RandomNumberController 67ce037b-5d64-4a16-a57d-fba78ceed8f8 | Generated random number:  72046864
```

The above log is contains the request id in the log, which is very useful when logs from concurrent requests
interleaves together.

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







