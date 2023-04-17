
## 2023-04-17


### Releases


| Package | Release Version | Release Type |
|---------|-----------------|--------------|
| `@sensejs/http-koa-platform` | `0.11.0-alpha.4 ` | minor |
| `@sensejs/container` | `0.11.0-alpha.4 ` | minor |
| `@sensejs/kafkajs` | `0.11.0-alpha.4 ` | minor |
| `@sensejs/core` | `0.11.0-alpha.4 ` | minor |
| `@sensejs/config` | `0.11.0-alpha.4 ` | minor |
| `@sensejs/http-common` | `0.11.0-alpha.4 ` | minor |
| `@sensejs/logger` | `0.11.0-alpha.4 ` | minor |
| `@sensejs/testing` | `0.11.0-alpha.4 ` | minor |



### Notable Changes

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



## 2023-04-14


### Releases


| Package | Release Version | Release Type |
|---------|-----------------|--------------|
| `@sensejs/multipart` | `0.11.0-alpha.3 ` | patch |
| `@sensejs/http-common` | `0.11.0-alpha.3 ` | patch |
| `@sensejs/http-koa-platform` | `0.11.0-alpha.3 ` | patch |



### Notable Changes

- **Summary**: 

  Add missing package.json in dist-cjs and dist-mjs folder

  **Affected packages**: 
   - Patch changes: 
     - `@sensejs/multipart`
- **Summary**: 

  Fix README

  **Affected packages**: 
   - Patch changes: 
     - `@sensejs/multipart`



## 2023-04-13


### Releases


| Package | Released Version | Released Type |
|---------|------------------|---------------|
| `@sensejs/multipart` | `0.11.0-alpha.2 ` | minor |
| `@sensejs/http-koa-platform` | `0.11.0-alpha.2 ` | minor |
| `@sensejs/http-common` | `0.11.0-alpha.2 ` | minor |
| `@sensejs/utility` | `0.11.0-alpha.2 ` | minor |



### Notable Changes

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

  Removed deprecated `createHttpModule`

  **Affected packages**:
   - Minor changes:
     - `@sensejs/http-koa-platform`
- **Summary**:

  Move impmentation specific config like CORS and trust-proxy setting from
  `@sensejs/http-common` to `@sensejs/http-koa-platform`.

  **Affected packages**:
   - Minor changes:
     - `@sensejs/http-common`
     - `@sensejs/http-koa-platform`
- **Summary**:

  add KeyOf<T> that excludes number to replace keyof T

  **Affected packages**:
   - Patch changes:
     - `@sensejs/utility`
- **Summary**:

  A new decorator `MultipartBody` was introduced in `@sensejs/http-common`,
  which requires the request body to be `multipart/formdata`, and an instance
  of `Multipart` from `@sensejs/multipart` will be injected for handling the
  request body.

  **Affected packages**:
   - Minor changes:
     - `@sensejs/http-common`



## 2023-04-10


### Releases


| Package | Released Version | Released Type |
|---------|------------------|---------------|
| `@sensejs/config` | `0.11.0-alpha.1 ` | patch |
| `@sensejs/container` | `0.11.0-alpha.1 ` | patch |
| `@sensejs/core` | `0.11.0-alpha.1 ` | patch |
| `@sensejs/http-common` | `0.11.0-alpha.1 ` | patch |
| `@sensejs/http-koa-platform` | `0.11.0-alpha.1 ` | patch |
| `@sensejs/kafkajs` | `0.11.0-alpha.1 ` | patch |
| `@sensejs/kafkajs-standalone` | `0.11.0-alpha.1 ` | patch |
| `@sensejs/kafkajs-zstd-support` | `0.11.0-alpha.1 ` | patch |
| `@sensejs/logger` | `0.11.0-alpha.1 ` | patch |
| `@sensejs/testing` | `0.11.0-alpha.1 ` | patch |
| `@sensejs/utility` | `0.11.0-alpha.1 ` | patch |
| `@sensejs/testing-utility` | `0.10.1-alpha.1 ` | patch |
| `@sensejs/example-demo-app` | `0.0.1 ` | none |
| `@sensejs/example-injection` | `0.0.1 ` | none |
| `@sensejs/example-hello-world` | `0.0.1 ` | none |



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

  Get rid of deprecated rxjs functions

  **Affected packages**:
   - Patch changes:
     - `@sensejs/core`



## 2023-04-08


### Releases


| Package | Released Version | Released Type |
|---------|------------------|---------------|
| `@sensejs/kafkajs-zstd-support` | `0.11.0-alpha.0 ` | minor |
| `@sensejs/kafkajs-standalone` | `0.11.0-alpha.0 ` | minor |
| `@sensejs/http-koa-platform` | `0.11.0-alpha.0 ` | minor |
| `@sensejs/testing-utility` | `0.10.1-alpha.0 ` | patch |
| `@sensejs/http-common` | `0.11.0-alpha.0 ` | minor |
| `@sensejs/container` | `0.11.0-alpha.0 ` | minor |
| `@sensejs/kafkajs` | `0.11.0-alpha.0 ` | minor |
| `@sensejs/testing` | `0.11.0-alpha.0 ` | minor |
| `@sensejs/utility` | `0.11.0-alpha.0 ` | minor |
| `@sensejs/config` | `0.11.0-alpha.0 ` | minor |
| `@sensejs/logger` | `0.11.0-alpha.0 ` | minor |
| `@sensejs/core` | `0.11.0-alpha.0 ` | minor |



### Notable Changes

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


