---
id: installation
sidebar_position: 1
---

# Installation


SenseJS is a collection of packages that can be used independently, the following packages are the minimum ones you
need to use SenseJS:

-  `reflect-metadata`, based on which the SenseJS framework accesses the decorator metadata.
-  `@sensejs/container`, the IoC container implementation of SenseJS.
-  `@sensejs/core`, the module system and core functionality of the framework.

In addition to the above packages, you may also need to install the following packages:

-  `@sensejs/http-common` and `@sensejs/http-koa-platform`, the former provides decorators that describe the HTTP
    semantics, the latter is the implementation based on koa ecosystem.

-  `@sensejs/kafkajs-standalone` and `@sensejs/kafkajs`, the former is a high-level encapsulation of `kafkajs`,
    the latter integrates it into the SenseJS framework.

-  `@sensejs/config`, integrates `config` to SenseJS.

## tsconfig configuration

To use SenseJS, you need to enable `experimentalDecorators` and `emitDecoratorMetadata` in `tsconfig.json`.

```json5

{
  "compileOptions": {
    //...
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    //...
  }
}

```

## Compatability

SenseJS 0.10.x supports Node.js 14 and above, and it's suggested to use the latest Typescript version.
The upcoming SenseJS 0.11.x will drop support for Node.js 14 and below.

## ESM support

All packages of SenseJS are dual-mode packages, which means they can be used in both CommonJS and ESM environments.






