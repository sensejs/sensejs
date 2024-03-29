# @sensejs/core

## 0.11.0

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
- 1c62bef: Get rid of deprecated rxjs functions
- Updated dependencies [88a823c]
- Updated dependencies [e791242]
- Updated dependencies [9eecdbf]
- Updated dependencies [f758473]
- Updated dependencies [15025d4]
- Updated dependencies [60a6361]
  - @sensejs/container@0.11.0
  - @sensejs/utility@0.11.0

## 0.11.0-alpha.4

### Patch Changes

- f7584735: Furthur optimize the MethodInvoker of `@sensejs/container`, though this has to
  be a breaking change, it make the MethodInvoker interface simpler, and gains
  abount 5% performance improvement.
- Updated dependencies [f7584735]
  - @sensejs/container@0.11.0-alpha.4

## 0.11.0-alpha.1

### Patch Changes

- 88a823c6: Fix packages.json for all packages:

  - fix incorrect packages exports for `@sensejs/http-koa-platform`
  - include CHANGELOG.md when publishing contents to npm registry

- 1c62befc: Get rid of deprecated rxjs functions
- Updated dependencies [88a823c6]
  - @sensejs/container@0.11.0-alpha.1
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
  - @sensejs/container@0.11.0-alpha.0
  - @sensejs/utility@0.11.0-alpha.0
