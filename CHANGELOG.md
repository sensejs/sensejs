
## 2023-05-11


### Releases


| Package | Release Version | Release Type |
|---------|-----------------|--------------|
| `@sensejs/multipart-s3-adaptor` | `0.11.1 ` | patch |
| `@sensejs/multipart` | `0.11.2 ` | patch |



### Notable Changes

- **Summary**: 

  Introuce `@sensejs/multipart-s3-adaptor` that provides an experimental S3 remote storage adaptor

  **Affected packages**: 
   - Patch changes: 
     - `@sensejs/multipart-s3-adaptor`
- **Summary**: 

  Introduce `MultipartFileRemoteStorage` and `RemoteStorageAdaptor`.

  **Affected packages**: 
   - Patch changes: 
     - `@sensejs/multipart`
- **Summary**: 

  Redesign the shape of MultipartFileEntry.
  
  It now has a new function member `body()` that returns a Readable;
  for MultipartFileInMemoryStorage an additional content field is
  presented for accessing the buffer directly, while for
  MultipartFileDiskStorage, the content field is deprecated and
  will be removed in 0.12

  **Affected packages**: 
   - Patch changes: 
     - `@sensejs/multipart`



## 2023-04-23


### Releases


| Package | Release Version | Release Type |
|---------|-----------------|--------------|
| `@sensejs/multipart` | `0.11.1 ` | patch |



### Notable Changes

- **Summary**: 

  Fix a bug that the files not removed on clean up if orror occurred

  **Affected packages**: 
   - Patch changes: 
     - `@sensejs/multipart`



## 2023-04-19


### Releases


| Package | Release Version | Release Type |
|---------|-----------------|--------------|
| `@sensejs/config` | `0.11.0 ` | minor |
| `@sensejs/container` | `0.11.0 ` | minor |
| `@sensejs/core` | `0.11.0 ` | minor |
| `@sensejs/http-common` | `0.11.0 ` | minor |
| `@sensejs/http-koa-platform` | `0.11.0 ` | minor |
| `@sensejs/kafkajs` | `0.11.0 ` | minor |
| `@sensejs/kafkajs-standalone` | `0.11.0 ` | minor |
| `@sensejs/kafkajs-zstd-support` | `0.11.0 ` | minor |
| `@sensejs/logger` | `0.11.0 ` | minor |
| `@sensejs/testing` | `0.11.0 ` | minor |
| `@sensejs/utility` | `0.11.0 ` | minor |
| `@sensejs/testing-utility` | `0.10.1 ` | patch |
| `@sensejs/multipart` | `0.11.0 ` | minor |



### Notable Changes

- **Summary**: 

  Fix packages.json for all packages:
  
  - fix incorrect packages exports for `@sensejs/http-koa-platform`
  - include CHANGELOG.md when publishing contents to npm registry

  **Affected packages**: 
   - Patch changes: 
     - `@sensejs/config`
     - `@sensejs/container`
     - `@sensejs/core`
     - `@sensejs/http-common`
     - `@sensejs/http-koa-platform`
     - `@sensejs/kafkajs-standalone`
     - `@sensejs/kafkajs-zstd-support`
     - `@sensejs/kafkajs`
     - `@sensejs/logger`
     - `@sensejs/testing-utility`
     - `@sensejs/testing`
     - `@sensejs/utility`
- **Summary**: 

  Introduce AsyncIterableQueue in `@sensejs/utility`, replace `event-iterator` with it in `@sensejs/multipart`

  **Affected packages**: 
   - Minor changes: 
     - `@sensejs/utility`
   - Patch changes: 
     - `@sensejs/multipart`
- **Summary**: 

  Introduce experimental multipart support
  
  This change introduce a new package `@sensejs/multipart` that based on
  `@fastify/busboy` to provide a high level multipart body handling with
  custom storage provider support and back pressure support.
  
  This package does not depends on the other part of SenseJS, and can be
  used standalong with any other HTTP framwork.

  **Affected packages**: 
   - Minor changes: 
     - `@sensejs/multipart`
- **Summary**: 

  Implement multipart body support in `@sensejs/http-koa-platform`.

  **Affected packages**: 
   - Minor changes: 
     - `@sensejs/http-koa-platform`
- **Summary**: 

  Add missing package.json in dist-cjs and dist-mjs folder

  **Affected packages**: 
   - Patch changes: 
     - `@sensejs/multipart`
- **Summary**: 

  Reorganize tsconfig.json for all packages.
  
  Due to Typescript Language Server does not support multiple tsconfig yet(https://github.com/microsoft/TypeScript/issues/33094). After upgrading to Typescript v5, all decorators in test files are treated as ECMA-Stage3 decorator, instead of the experimental legacy one. It can be overcome by using the following structure:
  
  ```
  +--src
  | |
  | + tsconfig.json # Use for editor support for files in ./src
  + tsconfig.json # Use for editor support for both ./src and ./tests
  ```
  
  Furthermore, a new type of tsconfig named `tsconfig.build-dts.json` will be added to each sub-project, and declarations will be emit into `dist-dts` folder, `tsconfig.build-esm.json` and `tsconfig.cjs.json` will emit only `.js` files.

  **Affected packages**: 
   - Patch changes: 
     - `@sensejs/config`
     - `@sensejs/container`
     - `@sensejs/core`
     - `@sensejs/http-common`
     - `@sensejs/http-koa-platform`
     - `@sensejs/kafkajs-standalone`
     - `@sensejs/kafkajs-zstd-support`
     - `@sensejs/kafkajs`
     - `@sensejs/logger`
     - `@sensejs/testing-utility`
     - `@sensejs/testing`
     - `@sensejs/utility`
- **Summary**: 

  Removed deprecated `createHttpModule`

  **Affected packages**: 
   - Minor changes: 
     - `@sensejs/http-koa-platform`
- **Summary**: 

  Furthur optimize the MethodInvoker of `@sensejs/container`, though this has to
  be a breaking change, it make the MethodInvoker interface simpler, and gains
  abount 5% performance improvement.

  **Affected packages**: 
   - Minor changes: 
     - `@sensejs/container`
   - Patch changes: 
     - `@sensejs/core`
     - `@sensejs/http-koa-platform`
     - `@sensejs/kafkajs`
- **Summary**: 

  Move impmentation specific config like CORS and trust-proxy setting from
  `@sensejs/http-common` to `@sensejs/http-koa-platform`.

  **Affected packages**: 
   - Minor changes: 
     - `@sensejs/http-common`
     - `@sensejs/http-koa-platform`
- **Summary**: 

  Fix README

  **Affected packages**: 
   - Patch changes: 
     - `@sensejs/multipart`
- **Summary**: 

  add KeyOf<T> that excludes number to replace keyof T

  **Affected packages**: 
   - Patch changes: 
     - `@sensejs/utility`
- **Summary**: 

  Get rid of deprecated rxjs functions

  **Affected packages**: 
   - Patch changes: 
     - `@sensejs/core`
- **Summary**: 

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
      @Middleware({
        provides: [InjectableA, InjectableB]
      })
      class MiddlewareProvidesInjetables {
        handle(next:(a: InjectableA, b: InjetableB)=>Promise<void>) {
          // implementations
        }
  
      }
      ```

  **Affected packages**: 
   - Minor changes: 
     - `@sensejs/container`
     - `@sensejs/core`
     - `@sensejs/http-common`
     - `@sensejs/http-koa-platform`
     - `@sensejs/kafkajs`
- **Summary**: 

  A new decorator `MultipartBody` was introduced in `@sensejs/http-common`,
  which requires the request body to be `multipart/formdata`, and an instance
  of `Multipart` from `@sensejs/multipart` will be injected for handling the
  request body.

  **Affected packages**: 
   - Minor changes: 
     - `@sensejs/http-common`



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



