SenseJS
=======

[![Code Quality](https://app.codacy.com/project/badge/Grade/2dcf1c5c1a0b4681bc9641194122bde9)](https://app.codacy.com/gh/sensejs/sensejs/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)
[![Code Coverage](https://app.codacy.com/project/badge/Coverage/2dcf1c5c1a0b4681bc9641194122bde9)](https://app.codacy.com/gh/sensejs/sensejs/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_coverage)

SenseJS is a flexible IoC Framework.

This project aims to provide an enterprise Typescript framework,  providing common components
for web application development like HTTP support while keep extensibility
to make end-user fit their own need.

See [Documentation](https://sensejs.io)

## BREAKING CHANGES
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





# LICENSE:
```
Copyright (C) 2021 LAN Xingcan and SenseJS contributors
All right reserved

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```
