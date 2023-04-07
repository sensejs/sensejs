---
'@sensejs/kafkajs-zstd-support': patch
'@sensejs/kafkajs-standalone': patch
'@sensejs/http-koa-platform': patch
'@sensejs/testing-utility': patch
'@sensejs/http-common': patch
'@sensejs/container': patch
'@sensejs/kafkajs': patch
'@sensejs/testing': patch
'@sensejs/utility': patch
'@sensejs/config': patch
'@sensejs/logger': patch
'@sensejs/core': patch
---

Reorganize tsconfig.json for all packages.

Due to Typescript Language Server does not support multiple tsconfig yet(https://github.com/microsoft/TypeScript/issues/33094). After upgrading to Typescript v5, all decorators in test files are treated as ECMA-Stage3 decorator, instead of the experimental legacy one. It can be overcome by using the following structure:

```
+--src
| |
| + tsconfig.json # Use for editor support for files in ./src
+ tsconfig.json # Use for editor support for both ./src and ./tests
```

Furthermore, a new type of tsconfig named `tsconfig.build-dts.json` will be added to each sub-project, and declarations will be emit into `dist-dts` folder, `tsconfig.build-esm.json` and `tsconfig.cjs.json` will emit only `.js` files.
