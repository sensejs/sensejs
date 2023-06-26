---
id: defining-injectables
sidebar_position: 1
---

# Defining Injectables


## Components

The most common way to define an injectable is to define a component. A component is a class decorated with
`@Component`.


```typescript

@Component()
class MyComponent {
  startTime = Date.now()

  getElapsed() {
      return Date.now() - this.startTime;
  }
}
```

### Constants

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







