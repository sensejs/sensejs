# @sensejs/http-koa-platform

## 0.11.0

### Minor Changes

- fbc78aa: Implement multipart body support in `@sensejs/http-koa-platform`.
- 6f91235: Removed deprecated `createHttpModule`
- 6f91235: Move impmentation specific config like CORS and trust-proxy setting from
  `@sensejs/http-common` to `@sensejs/http-koa-platform`.
- 60a6361: Introduce new decorator @Module for retiring @ModuleClass and @Middleware
  for retiring @MiddlewareClass, to make names of decorators more consist

  **Note that this is a breaking change**, the reason to mark itas **minor**
  change is that we're still in pre-1.0 era, and semantic versioning also
  allows breaking changes happens on minor change in pre-1.0 versions.

  - Migration from @ModuleClass to @ModuleClass will be an easily replace.

    Before:

    ```ts
    @ModuleClass({
      /** Options */
    })
    class MyModule {}
    ```

    After:

    ```ts
    @Module({
      /** Options */
    })
    class MyModule {}
    ```

  - Migration from @MiddlewareClass to @Middleware needs a bit extra works,
    but should be simple too.

    Before:

    ```ts
    @MiddlewareClass()
    class MiddlwareProvidesNoInjecdtable {
      handle(next: () => Promise<void>) {
        // implementations
      }
    }
    @MiddlewareClass(InjectableA, InjetableB)
    class MiddlewareProvidesInjetables {
      handle(next: (a: InjectableA, b: InjetableB) => Promise<void>) {
        // implementations
      }
    }
    ```

    After :

    ```ts
    @Middleware()
    class MiddlwareProvidesNoInjecdtable {
      handle(next: () => Promise<void>) {
        // implementations
      }
    }
    @Middleware({
      provides: [InjectableA, InjectableB],
    })
    class MiddlewareProvidesInjetables {
      handle(next: (a: InjectableA, b: InjetableB) => Promise<void>) {
        // implementations
      }
    }
    ```

### Patch Changes

- 88a823c: Fix packages.json for all packages:

  - fix incorrect packages exports for `@sensejs/http-koa-platform`
  - include CHANGELOG.md when publishing contents to npm registry

- 9eecdbf: Reorganize tsconfig.json for all packages.

  Due to Typescript Language Server does not support multiple tsconfig yet(https://github.com/microsoft/TypeScript/issues/33094). After upgrading to Typescript v5, all decorators in test files are treated as ECMA-Stage3 decorator, instead of the experimental legacy one. It can be overcome by using the following structure:

  ```
  +--src
  | |
  | + tsconfig.json # Use for editor support for files in ./src
  + tsconfig.json # Use for editor support for both ./src and ./tests
  ```

  Furthermore, a new type of tsconfig named `tsconfig.build-dts.json` will be added to each sub-project, and declarations will be emit into `dist-dts` folder, `tsconfig.build-esm.json` and `tsconfig.cjs.json` will emit only `.js` files.

- f758473: Furthur optimize the MethodInvoker of `@sensejs/container`, though this has to
  be a breaking change, it make the MethodInvoker interface simpler, and gains
  abount 5% performance improvement.
- Updated dependencies [88a823c]
- Updated dependencies [e791242]
- Updated dependencies [78821a2]
- Updated dependencies [f426f00]
- Updated dependencies [9eecdbf]
- Updated dependencies [f758473]
- Updated dependencies [6f91235]
- Updated dependencies [f3e8daf]
- Updated dependencies [15025d4]
- Updated dependencies [1c62bef]
- Updated dependencies [60a6361]
- Updated dependencies [9e158ee]
  - @sensejs/container@0.11.0
  - @sensejs/core@0.11.0
  - @sensejs/http-common@0.11.0
  - @sensejs/utility@0.11.0
  - @sensejs/multipart@0.11.0

## 0.11.0-alpha.4

### Patch Changes

- f7584735: Furthur optimize the MethodInvoker of `@sensejs/container`, though this has to
  be a breaking change, it make the MethodInvoker interface simpler, and gains
  abount 5% performance improvement.
- Updated dependencies [f7584735]
  - @sensejs/container@0.11.0-alpha.4
  - @sensejs/core@0.11.0-alpha.4
  - @sensejs/http-common@0.11.0-alpha.4

## 0.11.0-alpha.3

### Patch Changes

- Updated dependencies [f426f008]
- Updated dependencies [f3e8daf7]
  - @sensejs/multipart@0.11.0-alpha.3
  - @sensejs/http-common@0.11.0-alpha.3

## 0.11.0-alpha.2

### Minor Changes

- fbc78aab: Implement multipart body support in `@sensejs/http-koa-platform`.
- 6f912356: Removed deprecated `createHttpModule`
- 6f912356: Move impmentation specific config like CORS and trust-proxy setting from
  `@sensejs/http-common` to `@sensejs/http-koa-platform`.

### Patch Changes

- Updated dependencies [78821a2a]
- Updated dependencies [6f912356]
- Updated dependencies [15025d46]
- Updated dependencies [9e158eea]
  - @sensejs/multipart@0.11.0-alpha.2
  - @sensejs/http-common@0.11.0-alpha.2
  - @sensejs/utility@0.11.0-alpha.2

## 0.11.0-alpha.1

### Patch Changes

- 88a823c6: Fix packages.json for all packages:

  - fix incorrect packages exports for `@sensejs/http-koa-platform`
  - include CHANGELOG.md when publishing contents to npm registry

- Updated dependencies [88a823c6]
- Updated dependencies [1c62befc]
  - @sensejs/container@0.11.0-alpha.1
  - @sensejs/core@0.11.0-alpha.1
  - @sensejs/http-common@0.11.0-alpha.1
  - @sensejs/utility@0.11.0-alpha.1

## 0.11.0-alpha.0

### Minor Changes

- 60a6361: Introduce new decorator @Module for retiring @ModuleClass and @Middleware
  for retiring @MiddlewareClass, to make names of decorators more consist

  **Note that this is a breaking change**, the reason to mark itas **minor**
  change is that we're still in pre-1.0 era, and semantic versioning also
  allows breaking changes happens on minor change in pre-1.0 versions.

  - Migration from @ModuleClass to @ModuleClass will be an easily replace.

    Before:

    ```ts
    @ModuleClass({
      /** Options */
    })
    class MyModule {}
    ```

    After:

    ```ts
    @Module({
      /** Options */
    })
    class MyModule {}
    ```

  - Migration from @MiddlewareClass to @Middleware needs a bit extra works,
    but should be simple too.

    Before:

    ```ts
    @MiddlewareClass()
    class MiddlwareProvidesNoInjecdtable {
      handle(next: () => Promise<void>) {
        // implementations
      }
    }
    @MiddlewareClass(InjectableA, InjetableB)
    class MiddlewareProvidesInjetables {
      handle(next: (a: InjectableA, b: InjetableB) => Promise<void>) {
        // implementations
      }
    }
    ```

    After :

    ```ts
    @Middleware()
    class MiddlwareProvidesNoInjecdtable {
      handle(next: () => Promise<void>) {
        // implementations
      }
    }
    @MiddlewareClass({
      provides: [InjectableA, InjectableB],
    })
    class MiddlewareProvidesInjetables {
      handle(next: (a: InjectableA, b: InjetableB) => Promise<void>) {
        // implementations
      }
    }
    ```

### Patch Changes

- 9eecdbf: Reorganize tsconfig.json for all packages.

  Due to Typescript Language Server does not support multiple tsconfig yet(https://github.com/microsoft/TypeScript/issues/33094). After upgrading to Typescript v5, all decorators in test files are treated as ECMA-Stage3 decorator, instead of the experimental legacy one. It can be overcome by using the following structure:

  ```
  +--src
  | |
  | + tsconfig.json # Use for editor support for files in ./src
  + tsconfig.json # Use for editor support for both ./src and ./tests
  ```

  Furthermore, a new type of tsconfig named `tsconfig.build-dts.json` will be added to each sub-project, and declarations will be emit into `dist-dts` folder, `tsconfig.build-esm.json` and `tsconfig.cjs.json` will emit only `.js` files.

- Updated dependencies [9eecdbf]
- Updated dependencies [60a6361]
  - @sensejs/http-common@0.11.0-alpha.0
  - @sensejs/container@0.11.0-alpha.0
  - @sensejs/utility@0.11.0-alpha.0
  - @sensejs/core@0.11.0-alpha.0
