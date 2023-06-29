---
id: injection-scope
sidebar_position: 2
---

# 依赖注入域

所有的可注入对象都在某个域中定义，就像其他所有的依赖注入框架一样，SenseJS 提供了以下注入域：

-  `SINGLETON`：在这个域中定义的可注入对象在整个应用的生命周期中只会被实例化一次；

-  `SESSION`：在这个域中定义的可注入对象在每个依赖注入会话中只会被实例化一次，通常是一个请求的生命周期。如果未指定，这是组件的默认域；

-  `TRANSIENT`：在这个域中定义的可注入对象在每次注入时都会被实例化，如果有多个参数注入了这个可注入对象，那么它将被实例化多次。


要指定组件的域，可以使用 `@Scope()` 装饰器，例如：

```typescript

@Component()
@Scope(Scope.SINGLETON)
class SingletonComponent {

  myMethod() {
    //...
  }
}
```

对于通过工厂提供的可注入对象，可以通过如下方式指定其所在的域：

```typescript
const MyModule = createModule({
  factories: [{
    provide: MyInjectable,
    factory: MyFactory,
    scope: Scope.SINGLETON
  }]
});
```

对于常量可注入对象来说，它们总是在 `SINGLETON` 域中。

