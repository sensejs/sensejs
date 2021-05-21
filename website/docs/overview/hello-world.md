---
id: hello-world
sidebar_position: 2
---
# Hello world

Let us started with a boring hello world app to see how a SenseJS application looks like.

## Prerequisites

You shall setup a Node.js workspace with the following package installed.

- `ts-node`. we'll use it to run the demo. you can also install `typescript` instead and compile the source file
  manually before running.

- `reflect-metadata`, `@sensejs/http`, `@sensejs/core`. These package are required by this demo.

## Setup


Create a file named, say `main.ts`, with the following content

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
class MyApp {

  @OnModuleCreate()
  onModuleCreate() {
    console.log('service started');
  }
}
```

## Running

Then you can run this simple http service via

```bash
ts-node main.ts
```

After starting it, you shall be able to visit `http://localhost:8080/` to see the greeting from this app.

## What's next

Before going deeper into how to make an HTTP service, you may want to know more about the fundamental concepts
of SenseJS.











