---
id: defining-injectables
sidebar_position: 1
---

# 提供可注入对象


## 提供组件

一个组件就是被 `@Component` 装饰过的类。


```typescript

@Component()
@Scope(ComponentScope.SINGLETON)
class Timer {
  startTime = Date.now()

  getElapsed() {
      return Date.now() - this.startTime;
  }
}
const MyModule = createModule({
  components: [Timer]
});
```

## 提供常量可注入对象

以下示例可以通过提供 `Timer` 作为常量来实现相同的目标，区别是 `Timer` 的实例将在加载源文件时立即创建。

另外，注意常量可注入对象总是在 `SINGLETON` 作用域中。


```typescript
const TimerModule = createModule({
    constants: [{
        provide: Timer,
        value: new Timer()
    }]
});
```

## 通过工厂提供可注入对象


当需要使用工厂设计模式时，可注入对象也可以通过这种方式提供：

```typescript
class TimerFactory extends ComponentFactory<Timer> {
    build() {
        return new Timer();
    }
}


const TimerModule = createModule({
    factories: [{
        provide: Timer,
        scope: ComponentScope.SINGLETON,
        factory: TimerFactory
    }]
});
```







