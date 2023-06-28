---
id: hello-world
sidebar_position: 2
---
# 示例

本文将通过两个例子展示SenseJS的应用的结构

[//]: # (In this article, we will show you what a SenseJS application looks like with two simple examples.)

这些示例的代码可以从 [SenseJS 代码仓库] 中的 [examples](https://github.com/sensejs/sensejs/tree/master/examples/)
找到

[//]: # (The code of the examples in this article can be found at [examples]&#40;https://github.com/sensejs/sensejs/tree/master/examples/&#41;)

[//]: # (folder in the [SenseJS repository].)


## 配置

[//]: # (## Set up)

要运行代码仓库中的示例，你需要首先安装所有的依赖。

SenseJS 的代码仓库使用 [pnpm](https://pnpm.io/) 包管理器，所以你应当使用下面的命令


```
pnpm i -r
```

来安装依赖

[//]: # (To run the example from the SenseJS repository, you need to install the dependencies first.)

[//]: # ()
[//]: # (Note that the SenseJS repository uses [pnpm]&#40;https://pnpm.io/&#41; as the package manager, so you should run the following)

[//]: # ()
[//]: # (```)

[//]: # (pnpm i -r)

[//]: # (```)

[//]: # ()
[//]: # (to install the dependencies.)

当然，如果你想要自己从头编写示例代码，你需要配置一个 Node.js 项目并安装如下依赖：

-  `reflect-metadata`, `@sensejs/http`, `@sensejs/core`。这是示例运行所需要的依赖；

-  `typescript`. 应当将其作为开发依赖安装到你的示例项目中，除非你将其安装到了全局；

-  `ts-node`（可选），本文中会通过 `ts-node` 来运行示例代码，你也以将代码编译后运行编译产出的文件。


[//]: # (However, if you would like to write the code from scratch, you need to set up a Node.js project with the following)

[//]: # (packages installed.)

[//]: # (TODO: Remove)
[//]: # ()
[//]: # (These steps are also required among all the other examples in this repository, we will not repeat this section in)

[//]: # (the other articles.)

## Hello world

这个示例只有一个名为 `main.ts` 的文件，内容如下：


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

上面的代码是创建了一个简单的 Hello world HTTP 服务，并监听 `localhost:8080`。

[//]: # (The above code is a simple hello world HTTP service that will listen at `localhost:8080`.)

每次我们发起到 `http://localhost:8080/` 的 HTTP 请求时，`HelloWorldController` 都会被实例化一次，且其 `helloWorld`
方法将会被调用。


可以通过如下命令运行这个示例

[//]: # (TODO: Then you can run this example)
[//]: # (Then you can run this simple http service via)

```bash
ts-node main.ts
```

启动之后，你可以通过 HTTP 客户端，如 curl，访问 `http://localhost:8080/` 并观察其输出。


```
$ curl localhost:8080
hello world
```

## 依赖注入示例

[//]: # (## Dependency injection)

在这个示例中，我们将展示SenseJS框架下依赖注入是怎样进行的。

[//]: # (TODO: remove as well as other features)
[//]: # (In this example, we will show you how dependency injection works as well as other features of SenseJS.)

[//]: # (The code of this example can be found at [./examples/injection]&#40;)

[//]: # (https://github.com/sensejs/sensejs/tree/master/examples/injection&#41;)

这个示例的代码可以分为三部分：

-   `random-number.ts`：包含一个简单的组件 `RandomNumberGenerator` 和一个 HTTP 控制器 `RandomNumberController`
    用来查询或改变前者的状态，它们将会通过 `RandomNumberModule` 向外导出。

-   `http.module.ts`：包含了配置一个 HTTP 服务，及其所需的中间件的代码

-   `index.ts`：这个示例的入口点。


[//]: # (In this example, we separate the code into three parts.)

[//]: # ()
[//]: # (-  `random-number.ts`: contains a simple component `RandomNumberGenerator` and a controller `RandomNumberController` for querying or mutating the state)

[//]: # (   of `RandomNumberGenerator`, and exporting it as a module `RandomNumberModule`.)

[//]: # ()
[//]: # (-  `http.module.ts`: containing the code for setting up an HTTP server, including all middleware)

[//]: # (TODO: remove "which improts ...")
[//]: # (-  `index.ts`: the entry point of the application, which imports `RandomNumberModule` and `HttpModule` and start the)

[//]: # (   application.)


### RandomNumberModule

这一小节重点关注 `random-number.module.ts`

[//]: # (In this section we focused on file `random-number.module.ts`)

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

如你所见，`RandomNumberGenerator` 被装饰器 `@Component()` 装饰，使其成为一个组件并可注入到所需的对象。

[//]: # (As you see, the class `RandomNumberGenerator` is decorated with `@Component&#40;&#41;`, which makes it an injectable component.)

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

上面的类提供了一个 HTTP 控制器，用来查询或者改变 `RandomNumberGenerator` 的状态，它的构咱函数包含了两个参数。

第一个参数要求传入前面定义的 `RandomNumberGenerator` 类型的对象，第二个参数要求传入 `Logger`
类型的对象。在框架实例化这个控制器的时候，这些参数也会自动地被实例化并从构造函数参数注入。

[//]: # (The above class provides an HTTP controller to query or mutate the state of `RandomNumberGenerator`, its constructor)

[//]: # (has two parameters, the first one requires an instance of `RandomNumberGenerator`, which is defined previously,)

[//]: # (and the second one requires an instance of `Logger`. They will be instantiated and injected automatically when the)

[//]: # (controller is instantiated by the framework.)

当收到请求是，框架会实例化 `RandomNumberController`，并调用某个适用的方法；如果这个方法需要参数，同样地，框架也会注入这些参数。

比如，在处理 `POST /seed` 请求时，请求体中的 `seed` 字段将会被注入为 `reseed` 方法的参数。

[//]: # ( TODO: seed -> reseed)
[//]: # (When handling requests, the framework will instantiate an instance of `RandomNumberController`, and invoke the)

[//]: # (appropriate method, and if the method needs parameters, the framework will inject them automatically, For example,)

[//]: # (when handling, `POST /seed`, the `seed` field from the request body will be injected as the parameter.)

[//]: # ()
[//]: # (Finally, we package them into a module for exporting them for other modules to use.)

```typescript

export const RandomNumberModule = createModule({
  components: [RandomNumberGenerator, RandomNumberController]
});
```

### HttpModules

In this section, we focused on another file `./src/http.module.ts`.

We'll explain the content of this file in reverse order.

At the end of this file, we'll create an HTTP module and export it, just like what we did in the hello world example,
but this time we'll add some middlewares.

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
logger builder, so that all logger built from it will log with the request-id. This is very useful when you want to
distinguish logs from concurrent requests.

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




