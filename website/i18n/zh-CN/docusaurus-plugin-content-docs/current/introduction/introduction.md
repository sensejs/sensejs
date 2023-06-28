---
sidebar_position: 0
title: 简介
id: introduction
---

# 简介

SenseJS 是一个 Typescript 依赖注入框架，它可以帮助你以 SOLID[^1] 的方式构建高效可扩展的 Node.js
应用，使你的代码更容易测试、更松耦合、更易于维护。

## 功能

### 模块化的依赖注入系统

SenseJs 的核心建立在一个模块化的依赖注入系统之上。

所有的可注入对象由模块提供，并且由模块负责初始化和销毁。有些模块被可以响应请求，如HTTP，并将请求派发给合适的处理组件。

[//]: # (A module provides injectable components and is responsible for initializing and tearing them down. Some modules can)
[//]: # (handle requests, like HTTP, and dispatch them to an appropriate handler.)


一个 SenseJS 应用通常由一些列模块组成，由框架负责根据模块间的依赖关系，负责应用的优雅启动和退出。

[//]: # (A SenseJS application will be a collection of modules, and the framework will take care of the graceful setup and shutdown)
[//]: # (based on the dependency graph among modules.)

### 基于中间件的上下文相关注入

[//]: # (### Middleware-based contextual injection)

SenseJS 提供了一个强大的方法调用框架，可以调用任意组件的方法，而这些方法的参数，会自动从下来来源中注入：

-   任意模块中定义可注入的组件或Provider，它们通常是静态定义的，并且在程序启动时完成初始化

-   所有拦截了该方法调用的中间件，每个中间件都可以根据方法调用的上下文提供额外的可注入对象

[//]: # (SenseJS comes with a powerful method invoke framework, which can invoke arbitrary method of a component, with its)

[//]: # (parameter injected automatically from:)

[//]: # ()
[//]: # (-   Components and providers defined in all modules, which are usually statically defined and initialized when the)

[//]: # (    application starts.)

[//]: # ()
[//]: # (-   Middlewares that intercept the request, which can provide injectables based on the request context.)




[^1]: https://en.wikipedia.org/wiki/SOLID
