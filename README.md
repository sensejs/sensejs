SENSE.JS
========

[![Maintainability](https://api.codeclimate.com/v1/badges/6211de1ecc0f42993cf1/maintainability)](https://codeclimate.com/github/sensejs/sensejs/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/6211de1ecc0f42993cf1/test_coverage)](https://codeclimate.com/github/sensejs/sensejs/test_coverage)

SENSE.JS is a flexible IoC Framework.

This framework aims to provide an enterprise Typescript framework, based on
[inversify-js] to provide the ability of Dependency Injection, providing common components
for web application development like HTTP support while keep extensibility
to make end-user fit their own need.

WARNING: This project is still not stable yet.

Hello world
-------

```typescript
import {EntryPoint} from '@sensejs/core'
import {HttpModule, Controller, GET} from '@sensejs/http';

@Controller()
class WebController
{
  @GET('/')
  handleGet() {
    return "hello world";
  }
}

@EntryPoint()
class App extends HttpModule({
  controllers: [WebController],
  httpOption: {
    listenPort: 3000
  }
}) {

}

```

Concept
-------

1. `Component`

    Components are anything that registered into a container, either by type, factory or constant value. By listing them
    into a module, components can be registered when application is started.

    ```typescript
    import {Component, ComponentFactory, Module} from '@sensejs/core';

    @Component()
    class ClassComponent {}

    class Factory extends ComponentFactory<string> {
      async build() {
        return 'anything';
      }
    }

    const factoryComponent = { provide: Symbol('anything'), factory: Factory};

    const constantComponent = {provide: 'config', value: 'value'};

    const myModule = Module({ components: [ClassComponent], factories: [factoryComponent], constants: [constantComponent]});
    ```

2. `Module`

    Unlink Nest.js, Module in this framework is not only a set of components, but also an I/O lifecycle manager. Application
    can combines many modules to support multiple service entry point, for example:

    ```typescript
    import {HttpModule, Controller, GET} from '@sensejs/http';
    import {KafkaConsumerModule} from '@sensejs/kafka';
    import {EntryPoint, Module} from '@sensejs/core';

    const publicHttpModule = HttpModule({httpOption: {listenPort: 3000}, /*...*/});
    const internalHttpModule = HttpModule({httpOption: {listenPort: 3001}, /*...*/});
    const kafkaConsumerModule = KafkaConsumerModule({/*...*/});

    @EntryPoint()
    class App extends Module({ requires: [publicHttpModule, internalHttpModule, kafkaConsumerModule]}){}
    ```

[inversify-js]: http://inversify.io
