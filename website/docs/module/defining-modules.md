---
id: defining-modules
sidebar_position: 1
---

# Defining Modules

The most simple way to define a module is to call `createModule` function.

```typescript
const MyModule = createModule({
  requires: [],   // Other modules that are required by this module
  components: [], // Component injectable provided by this module
  factories: [],  // Dynamic injectable provided by this module
  constants: [],  // Constant injectables provided by this module
});
````

Usually, you define a module in this way when it only exports injectables.


When you need to use some advanced features of module, such as lifecycle hooks, you need to define a module with
decorator-style.

```typescript
@Module({
    requires: [],
    components: [],
    factories: [],
    constants: [],
})
class MyModule {

    constructor(@InjectLogger() logger: Logger) {
      logger.log('Hello from constructor of MyModule');
    }

    @OnModuleCreated()
    onModuleCreated(@InjectLogger() logger: Logger) {
      logger.info('Hello from onModuleCreated of MyModule');
    }
}
```


## Lifecycle hooks

SenseJS defined four lifecycle hooks for modules. Just like the module constructor, the parameters of these lifecycle
hooks are automatically injected by the framework.

-   `OnModuleCreated`/`OnModuleDestroy`: called when the module is created/destroyed, respectively.

    When one of your components needs to be initialized and de-initialized(such component must be singleton scoped),
    it shall be done in the `@OnModuleCreated` and `@OnModuleDestroy` hooks of the module that provides the component.

      ```typescript

      @Component({scope: ComponentScope.SINGLETON})
      export class DatabaseConnection {
          async connect() { }
          async disconnect() { }
          async query() { }
      }

      @Module({components: [DatabaseConnection]})
      export class DatabaseModule {

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

    So that `DatabaseConnection` is ensured to be connected before it can be used outside of `DatabaseModule`.

-   `OnModuleStart`/`OnModuleStop`: When a module is designed to handle requests, the initialization and
    de-initialization needs to be done in `@OnModuleStart` and `@OnModuleStop` hooks.

      ```typescript
      @Module()
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

    `OnModuleStart` hooks are ensured to be invoked after all `OnModuleCreated` hooks are finished for all modules,
    while `OnModuleDestroy` hooks are ensured to be finished before any invocation to `OnModuleDestroy` hooks. This is
    how SenseJS gracefully startup and shut down your app.

    Note that `OnModuleStart`/`OnModuleStop` hooks will be triggered only when the module is started by
    `ApplicationRunner.start`.

## Inter-module dependency

To control the initialization and de-initialization order, you need to specify which one depends on the other ones.
This is done by listing the dependent module in `requires` property of the module definition.

The following example shows how the need of controlling the initialize order, and how to specify the dependency.

```typescript
@Module({

  requires: [DatabaseModule],
})
class SomeFancyModule {


  @OnModuleCreated()
  async onModuleCreated(@Inject(DatabaseConnection) conn: DatabaseConnection) {
    // Reload state from the database
    // ...
  }

  @OnModuleDestroy()
  async onModuleDestroy(@Inject(DatabaseConnection) conn: DatabaseConnection) {
    // Persist state to the database
    // ...
  }
}
```

In the above code, `SomeFancyModule` need to inject an instance of `DatabaseConnection`, which is defined in
`DatabaseModule`, during its `OnModuleCreated` and `OnModuleDestroy` hooks. So it is necessary to specify
`DatabaseModule` in `requires` property, otherwise the `DatabaseConnection` may not be available when `SomeFancyModule`
is created or destroyed.

Note that once a module is initialized, any injectable provided by one module will be available to others, even
components from the other modules that do not list it as a dependency.

In other words, the inter-module dependency graph only affects the order of initialization and de-initialization but
does not restrict you from injecting anything from any other module.

Anyway, it is a good practice to explicitly specify the relationship between modules.
