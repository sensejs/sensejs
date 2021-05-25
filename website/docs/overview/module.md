---
id: module
sidebar_position: 3
---

# Module

The concept of module takes an important roles in SenseJS. It's designed to do the following job for your apps

- Pack injectables to make them to be available to be injected.
- Initialize and de-initialize injectables.

## Creating a module

You can create a module by decorating a class with `@ModuleClass`

```
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




