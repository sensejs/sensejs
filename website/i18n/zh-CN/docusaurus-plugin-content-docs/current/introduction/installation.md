---
id: installation
sidebar_position: 1
---

# 安装


SenseJS 包含了一系列可独立安装使用的软件包，以下是使用 SenseJS 框架所需的最精简的依赖：

- `reflect-metadata`, SenseJS 框架用以访问装饰其袁术其
- `@sensejs/container`, 实现了 SenseJS 的 IoC 容器
- `@sensejs/core`, 实现了 SenseJS 模块系统及相关核心功能

除上述软件包之外，根据情况可能还需要安装下列软件包：

-   `@sensejs/http-common` 和 `@sensejs/http-koa-platform`, 前者提供了用来描述 HTTP 语意的一系列装饰器，后者则提供了基于
   koa 生态的 HTTP 处理框架的实现；

-   `@sensejs/kafkajs-standalone` and `@sensejs/kafkajs`, 前者是对 `kafkajs` 的高层次封装，后者将其集成到了 `sensejs`
    框架；

-   `@sensejs/config`, 将 `config` 集成到了 SenseJS.

## tsconfig 配置

想要使用 SenseJS，`tsconfig.json` 需要启用 `experimentalDecorators` 和 `emitDecoratorMetadata`:

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

## 兼容性

SenseJS 0.10.x 支持 Node.js 14 及后续的版本，而 Typescript 的版本推荐使用最新版。
在随后的 SenseJS 0.11.x 中，Node.js 14 将不再被支持
The upcoming SenseJS 0.11.x will drop support for Node.js 14 and below.

## ESM 支持


SenseJS 的所有软件包都是双模的；也就是说它们都可以在 CommonJS 或 ESM 环境中使用。






