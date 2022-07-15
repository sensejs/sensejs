SenseJS
=======

[![Maintainability](https://api.codeclimate.com/v1/badges/6211de1ecc0f42993cf1/maintainability)](https://codeclimate.com/github/sensejs/sensejs/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/6211de1ecc0f42993cf1/test_coverage)](https://codeclimate.com/github/sensejs/sensejs/test_coverage)

SenseJS is a flexible IoC Framework.

This project aims to provide an enterprise Typescript framework,  providing common components
for web application development like HTTP support while keep extensibility
to make end-user fit their own need.

See [Documentation](https://sensejs.io)

## BREAKING CHANGES
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
