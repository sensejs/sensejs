---
id: hello-world
sidebar_position: 2
---
# Examples

In this article, we will show you what a SenseJS application looks like with two simple examples.

The code of the examples in this article can be found at [examples](https://github.com/sensejs/sensejs/tree/master/examples/)
folder in the [SenseJS repository].

## Set up

To run the example from the SenseJS repository, you need to install the dependencies first.

Note that the SenseJS repository uses [pnpm](https://pnpm.io/) as the package manager, so you should run the following

```
pnpm i -r
```

to install the dependencies.

However, if you would like to write the code from scratch, you need to set up a Node.js project with the following
packages installed.

- `reflect-metadata`, `@sensejs/http`, `@sensejs/core`. These packages are required to run this example.

- `typescript`. It should be the dev dependency of your project unless you have it installed globally.

- Optionally include `ts-node` in your dev dependencies, we'll use it to run the demo. you can also compile the source file
  manually before running the app.


Also, you need to configure the `tsconfig.json`, as instructed in [the previous article](./installation.md).

## Hello world

There is only a single file named `main.ts` in this example, with the following content.

```typescript
import 'reflect-metadata';
import {createKoaHttpModule, Controller, GET} from '@sensejs/http';
import {ApplicationRunner, ModuleClass, OnModuleCreate} from '@sensejs/core';

@Controller('/')
class HelloWorldController {

  @GET('/')
  helloWorld() {
    return 'hello world';
  }

}

@ModuleClass({
  requires: [
    createKoaHttpModule({
      components: [HelloWorldController],
      httpOption: {
        listenAddress: 'localhost',
        listenPort: 8080,
      }
    })
  ]
})
class HelloWorldApp {

  @OnModuleStart()
  onModuleCreate() {
    console.log('service started');
  }
}

ApplicationRunner.instance.start(HelloWorldApp);
```


You can run this simple http service via

```bash
ts-node main.ts
```

The above code create simple HTTP service that will listen at `localhost:8080`.

After starting it, you shall be able to visit `http://localhost:8080/` with an HTTP client, e.g. curl, to see the
output from this app.

```
$ curl localhost:8080
hello world
```

Each time we send an HTTP request to `http://localhost:8080/`, an instance of `HelloWorldController` will be
instantiated and the method `helloWorld` will be invoked, and the return value will be sent back to the HTTP client.



## Dependency injection

In this example, we will show you how dependency injection works.

The code of this example can be found at [./examples/injection](
https://github.com/sensejs/sensejs/tree/master/examples/injection)


In this example, we separate the code into three parts.

-  `random-number.ts`: contains a simple component `RandomNumberGenerator` and a controller `RandomNumberController` for querying or mutating the state
   of `RandomNumberGenerator`, and exporting it as a module `RandomNumberModule`.

-  `http.module.ts`: containing the code for setting up an HTTP server, including all middleware

-  `index.ts`: the entry point of the application, which imports `RandomNumberModule` and `HttpModule` and start the
   application.


### RandomNumberModule

In this section we focused on file `random-number.module.ts`

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

As you see, the class `RandomNumberGenerator` is decorated with `@Component()`, which makes it an injectable component.

```typescript

@Controller('/')
class RandomNumberController {

  constructor(@Inject(RandomNumberGenerator) private generator: RandomNumberGenerator,
              @InjectLogger() private logger: Logger) {}

  @GET('state')
  async get() {
    const state = this.generator.query();
    return {state};
  }

  @POST('next')
  async nextRandom() {
    const value = this.generator.next();
    this.logger.info('Generated random number: ', value);
    return {value};
  }

  @POST('reseed')
  async reseed(@Body() body: any) {
    const seed = Number(body?.seed);
    if (!Number.isInteger(seed)) {
      this.logger.warn('Invalid seed %s, ignored', seed);
    } else {
      this.generator.reseed(seed);
    }
    return {state: this.generator.query()};
  }
}

```

The above class provides an HTTP controller to query or mutate the state of `RandomNumberGenerator`, its constructor
has two parameters.

-   the first one requires an instance of `RandomNumberGenerator`, which is defined previously,
-   and the second one requires an instance of `Logger`.

They will be instantiated and injected automatically when the controller is instantiated by the framework.

When handling requests, the framework will instantiate an instance of `RandomNumberController`, and invoke the
appropriate method, and if the method needs parameters, the framework will inject them automatically based on the
decorator of each parameter.

For example, when handling request of `POST /reseed`, the request body will be injected as the parameter to the
`reseed` method.

At the end of this file, `RandomNumberGenerator` and `RandomNumberController` are packaged into a module
`RandomNumberModule`.

```typescript

export const RandomNumberModule = createModule({
  components: [RandomNumberGenerator, RandomNumberController]
});
```

### HttpModules

In this section, we focused on another file `./src/http.module.ts`.

We'll explain the content of this file in reverse order.

At the end of this file, a module is created by `createKoaHttpModule`, just like what we did in the hello world example,
but this time two middlewares are added.

```typescript
export const HttpModule = createKoaHttpModule({
  // We need to list RandomNumberModule here so that RandomNumberController can be discovered
  requires: [SenseLogModule, RandomNumberModule],

  // The order must not be changed, since REQUEST_ID is not defined before RequestIdMiddleware
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

There are two middleware defined prior to the HTTP module.

The first one, `RequestIdMiddleware` assigns a request-id to each request, and bound it to a symbol `REQUEST_ID`:

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

The second one, `ContextualLoggingMiddleware` injects the request-id bound in previous middleware and attaches it to a
logger builder, and in fact it overrides the LoggerBuilder in this request, so all logger created in this request will
share the same request-id, and their output can be grouped by the request-id easily. This is very useful when you want
to distinguish the logs from different concurrent requests.

```typescript

@Middleware({
  provides: [LoggerBuilder]
})
class ContextualLoggingMiddleware {

  constructor(
    // It'll be injected with a value provided by the previous interceptor
    @Inject(REQUEST_ID) private requestId: string,
    // It'll be injected with the LoggerBuilder defined in the global
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

In the entry file, we need to import `"reflect-metadata"` at the first place. Then we just create a module and mark it
as an entrypoint.


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


### Running

You can run this app and send requests with curl, you'll see output like this

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




[SenseJS repository]: https://github.com/sensejs/sensejs




