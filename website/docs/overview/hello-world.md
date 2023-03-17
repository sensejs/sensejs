---
id: hello-world
sidebar_position: 2
---
# Hello world

Let us started with a boring hello world app to see how a SenseJS application looks like.

The code of the example in this articles can be found at the directory
[./examples/hello-world](https://github.com/sensejs/sensejs/tree/master/examples/hello-world)
in the [SenseJs repository].

## Prerequisites

However, if you would like to write the code from scratch, you need to set up a Node.js workspace with the following
package installed.

- Install `reflect-metadata`, `@sensejs/http`, `@sensejs/core`. These package are required by this demo.

- Install `typescript`, if you don't have one installed globally.

- Optionally `ts-node`, we'll use it to run the demo. you can also compile the source file
  manually before running the app.

## The code

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




