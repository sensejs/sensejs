---
id: defining-injectables
sidebar_position: 1
---

# 定义可注入对象


## 组件

定义可注入对象最简单的方式是将一个类定义为组件，一个组件就是被 `@Component` 装饰过的类

[//]: # (The most common way to define an injectable is to define a component. A component is a class decorated with)

[//]: # (`@Component`.)


```typescript

@Component()
class MyComponent {
  startTime = Date.now()

  getElapsed() {
      return Date.now() - this.startTime;
  }
}
const MyModule = createModule({
  components: [MyComponent]
});
```

当然，所有的组件都需要注册到一个 `Module` ，才能被框架所知。


### 常量可注入对象

[//]: # (### Constants)



The following example archives almost the same goal by providing `Timer` as a constant, except that the instance of
`Timer` will be created immediately when the source file is loaded. Also, note that constant injectables are always
in `SINGLETON` scope.

```typescript
const TimerModule = createModule({
    constants: [{
        provide: Timer,
        value: new Timer()
    }]
});
```

### Factories

You can also define injectables through factories. The following example will archive the same goal by providing `Timer`
instance through a factory.

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







