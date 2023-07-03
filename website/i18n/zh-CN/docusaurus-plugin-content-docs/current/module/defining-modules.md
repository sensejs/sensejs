---
id: defining-modules
sidebar_position: 1
---

# 定义模块

最简单的定义一个模块的方式是调用 `createModule` 函数。

```typescript
const MyModule = createModule({
  requires: [],   // 本模块所依赖的其他模块
  components: [], // 本模块提供的组件
  factories: [],  // 本模块提供的有工厂提供的可注入对象
  constants: [],  // 本模块提供的常量可注入对象
});
````

通常，在需要一个仅导出可注入对象的模块时，使用这种方式定义模块


当你需要使用模块的高级特性，例如生命周期钩子时，你需要使用装饰器风格定义模块。


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

## 生命周期钩子

SenseJS 为模块定义了四个生命周期钩子。就像模块构造函数一样，这些生命周期钩子的参数也是由框架自动注入的。


-   `OnModuleCreated`/`OnModuleDestroy`: 当模块被创建和销毁时分别被调用

    当你的组件需要初始化和销毁时（这样的组件必须是单例作用域的），应该在提供该组件的模块的 `@OnModuleCreated`
    和 `@OnModuleDestroy` 钩子中完成。

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

    这样确保了 `DatabaseConnection` 在能被其他模块使用之前，已经连接好了。

-   `OnModuleStart`/`OnModuleStop`: 当一个模块被设计用来处理请求时，对应的初始化和销毁操作应该分别在 `@OnModuleStart`
    和 `@OnModuleStop` 中进行。

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

    `OnModuleStart` 钩子被确保在所有模块的 `OnModuleCreated` 钩子执行完毕后被调用，而 `OnModuleStop`
    钩子被确保在任一模块的 `OnModuleDestroy` 钩子执行前被调用完毕。这就是 SenseJS 如何优雅地启动和关闭你的应用。

    而 `OnModuleStart` 和 `OnModuleStop` 仅在应用通过 `ApplicationRunner.start`
    的方式启动时才会被调用。


## 模块间依赖关系

要控制模块的初始化和销毁顺序，你需要指定哪些模块依赖于其他模块。

一个模块的所有依赖可以在定义模块时通过 `requires` 属性中指定。


下面的例子展示了需要控制初始化顺序的场景，以及如何指定依赖关系。


```typescript
@Module({

  requires: [DatabaseModule],
})
class SomeFancyModule {


  @OnModuleCreated()
  async onModuleCreated(@Inject(DatabaseConnection) conn: DatabaseConnection) {
    // 从数据库中恢复状态
    // ...
  }

  @OnModuleDestroy()
  async onModuleDestroy(@Inject(DatabaseConnection) conn: DatabaseConnection) {
    // 向数据库中保存状态
    // ...
  }
}
```

在上面的代码中，`SomeFancyModule` 需要在其 `OnModuleCreated` 和 `OnModuleDestroy` 钩子中注入一个
`DatabaseConnection`，而 `DatabaseConnection` 是在 `DatabaseModule` 中定义的。因此，需要在 `requires` 属性中列出
`DatabaseModule`，否则在 `SomeFancyModule` 被创建或销毁时，`DatabaseConnection` 可能还不可用。

一旦一个模块完成了初始化，任何其他模块都可以注入该模块提供的任何可注入对象。

换句话说，模块间的依赖关系仅影响初始化和销毁的顺序，并不会限制你从其他模块注入任何对象。

但无论如何，显式指定模块间的依赖关系是一个好的实践。
