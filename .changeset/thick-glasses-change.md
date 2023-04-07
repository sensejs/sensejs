---
'@sensejs/http-koa-platform': minor
'@sensejs/http-common': minor
'@sensejs/container': minor
'@sensejs/kafkajs': minor
'@sensejs/core': minor
---

Introduce new decorator @Module for retiring @ModuleClass and @Middleware
for retiring @MiddlewareClass, to make names of decorators more consist

**Note that this is a breaking change**, the reason to mark itas **minor**
change is that we're still in pre-1.0 era, and semantic versioning also
allows breaking changes happens on minor change in pre-1.0 versions.

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
