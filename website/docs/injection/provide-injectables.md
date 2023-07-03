---
id: defining-injectables
sidebar_position: 1
---

# Provide Injectables


## Components

A component is a class decorated with `@Component`.


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

## Provide Constant Injectables

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

## Provide Injectable through Factory

When you need factory pattern, you can also provide injectables in this way:

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







