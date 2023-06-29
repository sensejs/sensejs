---
id: entrypoint
sidebar_pos: 2
---
# 入口点

每一个应用都有一个入口点，在 SenseJS 中，入口点是一个模块。

通常应用分为两类：一类是运行一次就退出的工具类应用；另一类是长期运行的应用，也就是常说的守护进程或服务。


## 工具类应用


在 SenseJS 中，这样的应用可以通过以下方式启动：


```typescript
@Module({ requires: [OtherModules] })
class MyApp {
    main() {
    }
}

ApplicationRunner.instance.run(MyApp, 'main');
```

第二个参数是入口函数的名称。当控制流离开 `main` 函数时，框架会销毁所有组件并退出进程。

## 守护进程类应用

这样的应用可以通过如下的方式启动：

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

或者通过装饰器的方式：

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

这类应用除了会调用 `@OnModuleCreated`/`@OnModuleDestroyed` 钩子之外，还会调用 `@OnModuleStart`/`@OnModuleStop` 钩子。

同时，这类应用不会在 `ProcessManager.exit()` 被调用或者收到退出信号之前退出。SenseJS 会确保所有的 `@OnModuleStop`
钩子被调用后应用才会退出。


## 总结

一个 SenseJS 应用是由多个模块组成的。有的模块负责组织可注入的对象，有的模块负责管理 I/O
资源的初始化和销毁，同时还有一个模块作为入口，依赖于其他所有模块。SenseJS
框架会根据所有模块的依赖关系图，优雅地启动和关闭你的应用。



