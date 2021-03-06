---
id: hello-world
sidebar_position: 2
---
# Hello world

Let us started with a boring hello world app to see how a SenseJS application looks like.

## Prerequisites

You shall set up a Node.js workspace with the following package installed.

- `ts-node`. we'll use it to run the demo. you can also install `typescript` instead and compile the source file
  manually before running.

- `reflect-metadata`, `@sensejs/http`, `@sensejs/core`. These package are required by this demo.

You can also find the complete source code in `examples/hello-world` of [SenseJS repository].

## Setup

Create a file named, say `main.ts`, with the following content.

If you don't want to do it by hand, you can also

```typescript
import 'reflect-metadata';
import {createHttpModule, Controller, GET} from '@sensejs/http';
import {EntryPoint, ModuleClass, OnModuleCreate} from '@sensejs/core';

@Controller('/')
class HelloWorldController {

  @GET('/')
  helloWorld() {
    return 'hello world';
  }

}

@EntryPoint()
@ModuleClass({
  requires: [
    createHttpModule({
      components: [HelloWorldController],
      httpOption: {
        listenAddress: 'localhost',
        listenPort: 8080,
      }
    })
  ]
})
class HelloWorldApp {

  @OnModuleCreate()
  onModuleCreate() {
    console.log('service started');
  }
}
```

The above code create a simple hello world http service that will listen at `localhost:8080`.

Each time we send http request to `http://localhost:8080/`, an instance of `HelloWorldController` will be instantiated
and the method `helloWorld` will be invoked.

## Running

Then you can run this simple http service via

```bash
ts-node main.ts
```

After starting it, you shall be able to visit `http://localhost:8080/` to see the greeting from this app.

## What's next

Before going deeper into how to make an HTTP service, you may want to know more about the fundamental concepts
of SenseJS.






[SenseJS repository]: https://github.com/sensejs/sensejs




