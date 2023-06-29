---
id: method-invoking
sidebar_position: 3
---

# 方法调用器

除了应用启动阶段，几乎所有的依赖注入都是由方法调用器触发的，对于守护进程类应用而言尤其如此。

正如之前提到的，方法调用器是 SenseJS 框架的核心，SenseJS 框架的许多功能，包括但不限于 HTTP 支持，都是基于它的。

本文将会指导你如何使用方法调用器。


## 示例

以下示例展示了怎样使用方法调用器调用一个组件的方法。


```typescript

const symbol1 = Symbol();
const symbol2 = Symbol();

@Component()
class TargetComponent {
  targetMethod(
    @Inject('foobar') foobar: string, // 将获得在 FooMiddleware 提供的 'FOOBAR'
    @Inject(symbol1) foo: string,     // 将获得调用 `invoke` 的第一个参数 'FOO'
    @Inject(symbol2) bar: string,     // 将获得调用 `invoke` 的第二个参数 'BAR'
  ) {
    console.log(foo, bar, foobar);
  }
}

@Middleware({
  provides: ['foobar']
})
class FooMidlleware {
  constructor(@Inject(symbol1) private foo: string, @Inject(symbol2) private bar: string) {

  }
  async handle(next: (foo: string) => Promise<void>) {
    await next(this.foo + this.bar);
  }
}


@EntryPoint()
@Module({
  components: [TargetComponent]
})
class MyModule {

  timer?: NodeJS.Timer;

  @OnModuleStart()
  onModuleStart(@Inject(Container) container: Container) {

    this.timer = setInterval(() => {

      container.createMethodInvoker(
        TagetComponent,
        'targetMethod',
        [FooMidlleware], // 调用时使用的中间件
        symbol1, // 调用invoke时通过第一个参数提供的可注入对象所绑定的 id
        symbol2, // 调用invoke时通过第二个参数提供的可注入对象所绑定的 id
      ).invoke(
        'FOO', // 将会绑定到 `symbol1`
        'BAR', // 将会绑定到 `symbol2`
      );
    }, 1000);
  }

  @OnModuleStop()
  onModuleStop() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

}
```

## 说明

在示例的代码中，我们定义了一个模块 `MyModule`，其中包含一个组件 `TargetComponent`。

在 `MyModule` 的 `OnModuleStart` 钩子中，我们创建了一个定时器，定时通过方法调用器调用 `TargetComponent` 的
`targetMethod` 方法，调用时提供了额外的可注入对象：

-  绑定到 `"foobar"` 的可注入对象由中间件 `FooMiddleware` 提供

-  绑定到 `symbol1` 和 `symbol2` 的可注入对象由 `invoke` 方法的参数提供

注意到，这些可注入对象没有在其他地方定义，它们仅在此次方法调用的会话中有效。

即使它们在其他地方定义了，调用时提供的值也会覆盖定义的值。

另外，`this.container.createMethodInvoker().invoke()` 会启动一个新的依赖注入会话，这意味着 `Scope.SESSION` 的
可注入对象每次都会被重新实例化。
