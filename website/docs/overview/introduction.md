---
sidebar_position: 1
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

### Interceptor based contextual injection

Requests can be intercepted when handled. In SenseJS, an interceptor can not only blocking requests or handling errors,
but also able to provide injectables that can be used by the dispatch target as
well as succeeded interceptors.

## Installation

To install SenseJS, you need to at least install the following packages,

- `reflect-metadata`
- `@sensejs/container`
- `@sensejs/core`

There are also some extra packages available based on your need,

- `@sensejs/http`, can be used when you're building an HTTP service.
- `@sensejs/kafkajs`, that integrates `@sensejs/kafkajs-standalone` to SenseJS, which is a high-level encapsulation of `kafkajs`.
- `@sensejs/typeorm`, integrates `typeorm` to SenseJS.
- `@sensejs/config`, integrates `config` to SenseJS.


[^1]: https://en.wikipedia.org/wiki/SOLID
