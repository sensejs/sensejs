
## BREAKING CHANGES PRIOR TO v0.11
-   0.10.x

1. Several deprecated classes, functions and parameters are removed

    - In `@sensejs/core`, the following deprecated functions and parameters are removed

      - `uuidV1`
      - `ComponentOption.scope`
      - `ComponentOption.bindParentConstructor`

    - `ResolveContext` are removed from `@sensejs/container`

2. The Concept of `InterceptProvider` are renamed to `Middleware`, results in plenty of changes:

    - Decorator `@InterceptProviderClass` is deprecated, and its usage should be replaced
      by `@MiddlewareClass`. And note that hape of a `Middleware` is different from `InterceptProvider`,
      the `intercept` method need to be renamed to `handle`.

      ```typescript
      @InterceptProviderClass(ServiceId1, ServiceId2)
      class MyInterceptor {
          async intercept(next: (value1: any, value2: any)=> Promise<void>) {
              await next(value1, value2);
          }
      }
      ```

      Now:

      ```typescript

      @MiddlewareClass()
      class MyInterceptor {
          async handle(next: (value1: any, value2: any)=> Promise<void>) {
              await next(value1, value2);
          }
      }
      ```

    - Field named `interceptProviders` in many types are deprecated, and its usage should
      be replaced by `middlewares`.



-   0.9.x

    This version introduces many breaking changes due to the IoC container has been rewritten.

-   IoC container now check missing dependencies and cyclic dependencies at application
    start-up time, rather than check it on resolve. This greatly improve the overall
    performance.

-   To make it possible to check dependencies at start-up time, the `RequestInterceptor`
    is replaced by `AsyncInterceptProvider`, this breaks the HTTP, kafka and
    builtin event publishing.

    Before:

    ```typescript
    class MyInterceptor extends HttpInterceptor {
        async intercept(context: HttpContext, next: ()=> Promise<void>) {
            context.bindContextValue(serviceId1, await getValue1());
            context.bindContextValue(serviceId2, await getValue2());
            await next();
        }
    }
    ```

    After:

    ```typescript

    // The `InterceptProviderClass` decorator accepts 0 to many service ids to denote what
    // injectables will be provided, if they do not match with the type of parameter of `next`,
    // it will cause compile error
    @InterceptProviderClass(serviceId1, serviceId2)
    class MyInterceptor {
        // In case you need context, inject it through constructor
        construct(@Inject(HttpContext) context: HttpContext) {}

        async intercept(next: (value1: any, value2: any)=> Promise<void>) {
            const value1 = await getValue1();
            const value2 = await getValue2();
            await next(value1, value2); // The injectable is now provided through argument of next
        }
    }
    ```



