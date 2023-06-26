---
id: injection
sidebar_position: 3
---

# Dependency Injection

SenseJS framework provides an advanced injection framework, which features

-  Constructor parameters injection, which is exactly what your expected for a dependency injection framework

-  Injectables provided by middlewares, which is the most powerful and elegant part of SenseJs. In this article,
   we'll show you that it's very useful when combining with a traceable logger.

-  Method invocation framework, based on which the `@sensejs/http` handles requests, where the request parameters
   are provided as an injectable and bound to the parameters of the target method. It can also be useful if you need
   to integrate other RPC frameworks with SenseJS.

## Example

We'll show you all the powerful features in an example.

The code of this example can be found at the directory [./examples/injection](
https://github.com/sensejs/sensejs/tree/master/examples/injection) in the [SenseJs repository].

This example we separate the code into three parts.

-  `random-number.ts`: contains a simple component `RandomNumberGenerator` and a controller `RandomNumberController` for querying or mutating the state
   of `RandomNumberGenerator`, and exporting it as a module `RandomNumberModule`.

-  `http.module.ts`: containing the code for setting up an HTTP server, including all middleware

-  `index.ts`: the entry point of the application, which imports `RandomNumberModule` and `HttpModule` and start the
   application.


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

As you see, the class `RandomNumberGenerator` is decorated with `@Component()`, which make it an injectable component.

In addition to `@Component()`, it's also decorated with `@Scope(Scope.SINGLETON)` as we want to ensure that there is
only one instance of `RandomNumberGenerator` exists in the whole dependency injection context, note that it does not
prevent you from creating multiple instances of `RandomNumberGenerator` manually.

In addition to the `SINGLETON` scope, a component can also be marked as `SESSION` scope or `TRANSIENT` scope (which is
the default). The differences between them are explained below:

-  `SINGLETON`: Only instantiated once during the application lifetime.

-  `SESSION`: Only instantiated once in each dependency injection session, which is usually the lifetime of a request.
   It is also the default scope of a component if unspecified

-  `TRANSIENT`:  Create instances each time for each param that needs such a component, if more than one param needs
   such a component, multiple instances will be created.

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

In this section we focused on another file `./src/http.module.ts`.

We'll explain th content of this file in reverse order.


#### Http module

In the end of this file, we'll create an HTTP module and export it, just like what we did in the hello world example,
but this time we'll add some middlewares.

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


#### Middlewares

The middlewares are defined prior to the HTTP module.

The first one, `RequestIdMiddleware` assigns a request id to each request, and bound it to a symbol `REQUEST_ID`:

```typescript
import {randomUUID} from 'crypto';

const REQUEST_ID = Symbol('REQUEST_ID');

@Middleware({
  provides: [REQUEST_ID]
})
class RequestIdMiddleware {

  async intercept(next: (requestId: string) => Promise<void>) {
    const requestId = randomUUID();
    // The parameter passed to next() will be bound to REQUEST_ID
    await next(requestId);
  }
}
```

The second one, `ContextualLoggingMiddleware` injects the request id bound in previous middleware and attach it to a
logger builder, so that all logger build from it will log with the request id. This is very useful when you want to
distinguish logs from concurrent requests.

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
    // The parameter passed to next() will be bound to LoggerBuilder
    await next(slb);
  }

}

```

### Entrypoint

In the entry file we need to import `"reflect-metadata"` at first place. Then we just create a module and mark it as
entrypoint.


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

That's it.


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







