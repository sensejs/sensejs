# @sensejs/testing-utility

## 0.10.1

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

## 0.10.1-alpha.1

### Patch Changes

- 88a823c6: Fix packages.json for all packages:

  - fix incorrect packages exports for `@sensejs/http-koa-platform`
  - include CHANGELOG.md when publishing contents to npm registry

## 0.10.1-alpha.0

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
