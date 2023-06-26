---
id: module
sidebar_position: 4
---

# Module


In the previous articles, we've learned to export injectables through modules. You might note that to set up an HTTP
server, `createHttpModule` is called, which returns a module that manages HTTP traffics for you.

You might also note that the application entry point is also a module.

The concept of the module takes an important roles in SenseJS. It's designed to do the following job for your
application:

- Provide entry points for your application.

- Export injectables for other modules and components to use.

- Initialize and de-initialize components and I/O resources, such as creating database connections and establishing
  HTTP listeners.

We'll discuss these topics in this chapter.


## Inter-Module dependencies


