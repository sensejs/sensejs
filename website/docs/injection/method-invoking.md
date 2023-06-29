---
id: method-invoking
sidebar_position: 3
---

# Method Invoking Framework

Dependency injections happen during method invoking. The `@sensejs/http` and `@sensejs/kafka` are built on top of the
method-invoking framework. You can also use it to integrate other RPC frameworks with SenseJS.

This article will guide you on how to use the method-invoking framework. The following is an example.

## Example

The following example shows how to invoke a method of a component with the help of the framework.

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
    return foo + bar === 'FOOBAR'
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


@Controller('/')
class MyController {

  conctructor(@Inject(Container) container: Container) {

  }

  @POST('/')
  async invokeTargetMethod(@Inject(TargetComponent) targetComponent: TargetComponent) {
    await this.container.createMethodInvoker(
      TargetComponent,
      'targetMethod'
      [FooMidlleware], // The middlewares that configured for this invokation
      symbol1, // the injectable id for the first argument of `invoke`
      symbol2, // the injectable id for the second argument of `invoke`
    ).invoke(
      'FOO', // will bound to `symbol1`
      'BAR', // will bound to `symbol2`
    );
  }
}

export const MyModule = createModule({
  components: [TargetComponent, MyController],
})

```

## Explanation

In the above code, we define a module with two components `TargetComponent` and `MyController`.

When `MyContoller` handle a request, it will invoke the method `targetMethod` of `TargetComponent`, with additional
injectables supplied:

  - Injectables bound to `"foo"` is supplied by the middleware `FooMiddleware`

  - Injectables bound `symbol1` and `symbol2` are supplied through the parameter of `invoke` method

Note that these injectables are not defined elsewhere in this example, they are only available during the invocation,
even if any of them is defined, the supplied value will override the defined one.

Also note that `this.container.createMethodInvoker().invoke()` initiates a new session of dependency injection, which
means that injectables within `Scope.SESSION`, will be instantiated for each invocation, despite whether they are
instantiated during the invocation of `MyController.invokeTargetMethod`.





