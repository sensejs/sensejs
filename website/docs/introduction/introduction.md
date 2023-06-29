---
sidebar_position: 0
title: Introduction
id: introduction
---

# Introduction

SenseJS is Typescript framework that helps you build efficient and scalable Node.js applications in a [SOLID] way so
that your code will be highly testable, loosely coupled, and easily maintainable.

## Features

### Modularized Dependency Injection and Resource Management

The module system plays a central role in SenseJS, which

-   Manage the of injectables, and initialization and de-initialization of resources that used by injectables

-   The framework performs graceful startup and shutdown based on the dependency graph among modules.


### Powerful method invoke framework

SenseJS comes with a powerful method invoke framework with enhanced dependency injection support, which can invoke
arbitrary method of a component, with its parameter injected automatically from:

-   Injectables defined in any module

-   Injectables that are provided contextually by middlewares that intercept the method invocation.

Note that the HTTP part of SenseJS is based on this method invoke framework, but it is also opened to be used for
integrating any other RPC framework.


When

[//]: # (-   )

[//]: # (, which can invoke arbitrary method of a component, with its)

[//]: # (parameter injected automatically from:)

[//]: # ()
[//]: # (-   Components and providers defined in all modules, which are usually statically defined and initialized when the)

[//]: # (    application starts.)

[//]: # ()
[//]: # (-   Middlewares that intercept the request, which can provide injectables based on the request context.)




[SOLID]: https://en.wikipedia.org/wiki/SOLID
