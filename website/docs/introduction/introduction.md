---
sidebar_position: 0
title: Introduction
id: introduction
---

# Introduction

SenseJS is Typescript framework that helps you build efficient and scalable Node.js applications in a SOLID[^1] way so
that your code will be highly testable, loosely coupled, and easily maintainable.

## Features

### Modularized IoC system

The core of the SenseJS is based on a modularized IoC system.

A module provides injectable components and is responsible for initializing and tearing them down. Some modules can
handle requests, like HTTP, and dispatch them to an appropriate handler.

Your application will be a collection of modules, and the framework will take care of the graceful setup and shutdown
based on the dependency graph among modules.

### Middleware-based contextual injection

SenseJS comes with a powerful method invoke framework, which can invoke arbitrary method of a component, with its
parameter injected automatically from:

-   Components and providers defined in all modules, which are usually statically defined and initialized when the
    application starts.

-   Middlewares that intercept the request, which can provide injectables based on the request context.




[^1]: https://en.wikipedia.org/wiki/SOLID
