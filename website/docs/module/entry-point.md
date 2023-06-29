---
id: entrypoint
sidebar_pos: 2
---
# Entry point

Every application has an entry point, in SenseJS, an entry point is a module.

Usually, applications can be divided into two categories: one is utility applications that run once and exits when
the job is done or failed; the other is long-running applications that keep running and waiting for requests,
a.k.a. daemons or servers.


## Utility applications

In SenseJS, such an application can be started through:
```typescript
@Module({ requires: [OtherModules] })
class MyApp {
    main() {
    }
}

ApplicationRunner.instance.run(MyApp, 'main');
```

the second argument of `ApplicationRunner.instance.run` is the name of the entry function. Once the control-flow leaves
the `main` function, the framework will destroy all components and exit the process.

## Daemon applications

Such an application can be started through:

```typescript
@Module({ requires: [OtherModules] })
class MyApp {
    @OnModuleStart()
    onModuleStart() {
        // Start listening for requests
    }
    @OnModuleStop()
    onModuleStop() {
        // Stop listening for requests
    }
}
ApplicationRunner.instance.start(MyApp);
```

or through decorators:

```typescript
@Entrypoint()
@Module({ requires: [OtherModules] })
class MyApp {
  @OnModuleStart()
  onModuleStart() {
    // Start listening for requests
  }
  @OnModuleStop()
  onModuleStop() {
    // Stop listening for requests
  }
}
```

In addition to the `@OnModuleCreated`/`@OnModuleDestroyed` hooks, applications running in this way will also invoke
`@OnModuleStart`/`@OnModuleStop`.

Such an app will not exit until `ProcessManager.exit()` is called or any exit signals are received. SenseJS also ensures
all `@OnModuleStop` hooks are invoked before the app exits.

## Conclusion

A typical SenseJS application is a collection of modules. Some modules are organizing injectables, while some modules
are managing initialization and de-initialization of I/O resources, and an entry module that depends on all the others.
Based on the dependency graph of all the modules, SenseJS can gracefully start up and shut down your application.

