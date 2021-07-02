---
id: module
sidebar_position: 3
---

# Module

In this article, we'll discuss more details about SenseJS modules.

In the previous article, you've learned to export injectables through modules. You might note that to start an HTTP
server, `createHttpModule` is called, which manages HTTP traffics for you. You might also note that the application
entry point is also a module.

The concept of the module takes an important roles in SenseJS. It's designed to do the following job for your
application:

- Export injectables to make them injectable to others
- Initialize and de-initialize injectables and its underlying I/O system.

## Creating a module

You can create a module by decorating a class with `@ModuleClass`

```typescript
@ModuleClass({
    requires: [],   // Other modules that required by this module
    components: [], // Component injectable provided by this module
    factories: [],  // Dynamic injectable provided by this module
    constants: [],  // Constant injectables provided by this module
})
class MyModule {

    @OnModuleCreated()
    onModuleCreated() {} // perform initialization here

    @OnModuleCreated()
    onModuleDestroy() {} // perform de-initialization here
}
```

In case that you don't need the lifecycle hooks, you can also create a module by

```typescript
const MyModule = createModule({
    requires: [],
    components: [],
    factories: [],
    constants: [],
});
```

## Lifecycle hooks

Sometimes your components need to be initialized and de-initialized, it can be done in the
life cycle hooks of a module.

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

## Conclusion

From a global perspective, a typical SenseJS application is composed of modules. Some modules are organizing
injectables, while some modules are also managing I/O. Based on the dependency graph of all the modules, SenseJS can
gracefully startup and shut down your application.




