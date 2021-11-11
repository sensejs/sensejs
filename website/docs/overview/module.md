---
id: module
sidebar_position: 4
---

# Module

In this article, we'll discuss more details about SenseJS modules.

In the previous article, you've learned to export injectables through modules. You might note that to start an HTTP
server, `createHttpModule` is called, which manages HTTP traffics for you. You might also note that the application
entry point is also a module.

The concept of the module takes an important roles in SenseJS. It's designed to do the following job for your
application:

- Provide entry points for your application.

- Export injectables for other modules and components to use.

- Initialize and de-initialize components and I/O resources, such as creating database connections and establishing
  HTTP listeners.

## Creating a module

You can create a module by decorating a class with `@ModuleClass`.

```typescript
@ModuleClass({
    requires: [],   // Other modules that required by this module
    components: [], // Component injectable provided by this module
    factories: [],  // Dynamic injectable provided by this module
    constants: [],  // Constant injectables provided by this module
})
class MyModule {

    constructor(@Inject(Loggable) loggable: Loggable) {
        loggable.log('Hello from MyModule');
    }

    @OnModuleCreated()
    onModuleCreated() {} // perform initialization here

    @OnModuleCreated()
    onModuleDestroy() {} // perform de-initialization here
}
```

A module can have a constructor, and its parameters are automatically injected by the framework.

In case that neither constructor nor lifecycle hooks is needed, you can also create a module in a simpler way:

```typescript
const MyModule = createModule({
    requires: [],
    components: [],
    factories: [],
    constants: [],
});
```

## Lifecycle hooks

SenseJS defined four lifecycle hooks for modules. Just like module constructor, parameters of these lifecycle hooks
are automatically injected by the framework.

- `OnModuleCreated`/`OnModuleStop`: called when the module is created/destroyed, respectively.

    When your components need to be initialized and de-initialized, it shall be done in the
    `@OnModuleCreate` and `@OnModuleDestroy` hooks of a module.

    ```typescript

    @Component({scope: ComponentScope.SINGLETON})
    class DatabaseConnection {
        async connect() { }
        async disconnect() { }
        async query() { }
    }

    @ModuleClass({components: [DatabaseConnection]})
    class DatabaseModule {

        @OnModuleCreated()
        async onCreated(@Inject(DatabaseConnection) conn) {
            await conn.connect();
        }

        @OnModuleDestroy()
        async onDestroyed(@Inject(DatabaseConnection) conn) {
            await conn.disconnect();
        }
    }
    ```

- `OnModuleStart`/`OnModuleStop`: only when you start your app via `ApplicationRunner.start`(see [EntryPointModules](#entry-point-modules))

    When a module is designed to handle requests, it needs`@OnModuleStart` and `@OnModuleStop` hooks.

    ```typescript
    @ModuleClass()
    class TcpEchoServerModule {
        tcpServer?: net.Server;

        @OnModuleStart()
        async onCreated() {
            this.tcpServer = net.createServer((conn)=> conn.pipe(conn)).listen(3000);
        }

        @OnModuleStop()
        async onDestroyed() {
            if (this.tcpServer) {
                this.tcpServer.close();
            }
        }
    }
    ```

    `OnModuleCreate` hooks are ensured be invoked after all `OnModuleCreated` hooks finished, while `OnModuleDestroy`
    hooks are ensured to be invoked before any `OnModuleDestroy` hooks. This is how SenseJS gracefully startup and
    shutdown your app.


## Inter-Module dependencies

To control the initialization and de-initialization order, you need to specify which one depends on the other ones.

```typescript

@Controller()
class MyController {

    @GET('/')
    async query(@Inject(DatabaseConnection) conn) {
        return conn.query();
    }
}


const BusinessLogicModule = createModule({
    requires: [DatabaseModule],
    components: [MyController],
});
```

Note that once a module is initialized, anything provided by it will be injectable to others, even components from the
other modules that do not list it as a dependency. In other words, the inter-module dependency graph only affects the
order of initialization and de-initialization but does not restrict you from injecting anything from any other module.
However, it is still a good practice to carefully consider the relationship between modules.

## Entry point modules

There ought to be an entry point for an app. In SenseJS, your app can be started through:
```typescript
@ModuleClass({ requires: [OtherModules] })
class MyApp {
    main() {
    }
}

ApplicationRunner.instance.run(MyApp, 'main');
```
And your app will exit when it returns from `main`.

Some app may not have any explicit entry function, but establish a listener in `OnModuleStart` hooks and then
wait for requests. In this case, you can use `ApplicationRunner.instance.start` to start your app.

```typescript
@ModuleClass({ requires: [OtherModules] })
class MyApp {
    @OnModuleStart()
    onModuleStart() {
        // start listening for requests
    }
    @OnModuleStop()
    onModuleStop() {
        // stop listening for requests
    }
}
ApplicationRunner.instance.start(MyApp);
```

Such app will not exit until `ProcessManager.exit()` is called or any exit signals are received. SenseJS also ensures
all `@OnModuleStop` hooks are invoked before the app exits.

## Conclusion

From a global perspective, a typical SenseJS application is composed of modules. Some modules are organizing
injectables, while some modules are also managing I/O, and an entry module that depends on all the others.
Based on the dependency graph of all the modules, SenseJS can gracefully start up and shut down your application.




