---
id: method-invoking
sidebar_position: 3
---

# Method Invoker

Except for start up, almost all dependency injections is triggered by the method invoker, especially for daemon
applications.

As mentioned before, the method invoker is the core of SenseJS framework, functionalities in SenseJS including
but not limited to HTTP-support are based on it.

This article will guide you on how to use the method invoker.

## Example

The following example shows how to invoke a method of a component with the help of the method invoker.

```typescript
const symbol1 = Symbol();
const symbol2 = Symbol();

@Component()
class TargetComponent {
  targetMethod(
    @Inject('foobar') foobar: string, // will get 'FOOBAR' from FooMiddleware
    @Inject(symbol1) foo: string,     // will get 'FOO' from the first argument of `invoke`
    @Inject(symbol2) bar: string,     // will get 'BAR' from the second argument of `invoke`
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
        [FooMidlleware], // The middlewares that configured for this invokation
        symbol1, // the injectable id for the first argument of `invoke`
        symbol2, // the injectable id for the second argument of `invoke`
      ).invoke(
        'FOO', // will bound to `symbol1`
        'BAR', // will bound to `symbol2`
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

## Explanation

In the example code, we define a module `MyModule` with a component `TargetComponent`.

In the `OnModuleStart` hook of `MyModule`, we create a timer that periodically invoke the method `targetMethod` of
`TargetComponent` with the help of the method invoker, with additional injectables supplied:

  - Injectables bound to `"foobar"` is supplied by the middleware `FooMiddleware`

  - Injectables bound `symbol1` and `symbol2` are supplied through the parameter of `invoke` method

Note that these injectables are not defined elsewhere in this example, they are only available during the invocation
session.

Even if any of them is defined elsewhere, the supplied value will override the defined one.

Also note that `this.container.createMethodInvoker().invoke()` initiates a new session of dependency injection, which
means that injectables within `Scope.SESSION`, will be instantiated for each invocation.





