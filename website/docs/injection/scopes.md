---
id: injection-scope
sidebar_position: 2
---

# Injection Scope

All injectables are defined within a scope. Just like all other dependency injection frameworks, SenseJS provides
the following injection scopes:

-  `SINGLETON`: Injectables within this scope will be instantiated only once during the application lifetime.

-  `SESSION`: Injectables within this scope will be instantiated once in each dependency injection session, which is
    usually the lifecycle of a request. It is also the default scope of a component if unspecified

-  `TRANSIENT`: Injectables within this scope are instantiated each time for each param it bound to; if more than one
   param bound to such an injectable, multiple instances of it will be created.

To specify the scope of a component, you can use the `@Scope()` decorator, for example:

```typescript

@Component()
@Scope(Scope.SINGLETON)
class SingletonComponent {

  myMethod() {
    //...
  }
}
```


For injectables provided by a factory, the scope is specified by their provider:

```typescript
const MyModule = createModule({
  factories: [{
    provide: MyInjectable,
    factory: MyFactory,
    scope: Scope.SINGLETON
  }]
});
```

While constant injectables are always `SINGLETON` scoped.
