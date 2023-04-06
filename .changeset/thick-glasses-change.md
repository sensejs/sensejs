---
'@sensejs/http-koa-platform': major
'@sensejs/http-common': major
'@sensejs/container': major
'@sensejs/kafkajs': major
'@sensejs/core': major
---

Introduce new decorator @Module for retiring @ModuleClass and @Middleware
for retiring @MiddlewareClass, to make names of decorators more consist

-   Migration from @ModuleClass to @ModuleClass will be an easily replace.

    Before:

    ```ts

    @ModuleClass({ /** Options */ })
    class MyModule {

    }

    ```

    After:
    ```ts
    @Module({ /** Options */ })
    class MyModule {

    }
    ```

-   Migration from @MiddlewareClass to @Middleware needs a bit extra works,
    but should be simple too.

    Before:

    ```ts
    @MiddlewareClass()
    class MiddlwareProvidesNoInjecdtable {
      handle(next:()=>Promise<void>) {
        // implementations
      }
    }
    @MiddlewareClass(InjectableA, InjetableB)
    class MiddlewareProvidesInjetables {
      handle(next:(a: InjectableA, b: InjetableB)=>Promise<void>) {
        // implementations
      }

    }
    ```
    After :

    ```ts
    @Middleware()
    class MiddlwareProvidesNoInjecdtable {
      handle(next:()=>Promise<void>) {
        // implementations
      }
    }
    @MiddlewareClass({
      provides: [InjectableA, InjectableB]
    })
    class MiddlewareProvidesInjetables {
      handle(next:(a: InjectableA, b: InjetableB)=>Promise<void>) {
        // implementations
      }

    }
    ```
