---
id: injection
sidebar_position: 0
---

# Dependency Injection

SenseJS framework provides an advanced injection framework, which features

-  Constructor parameters injection, which is exactly what your expected for a dependency injection framework

-  Injectables provided by middlewares, which is the most powerful and elegant part of SenseJS.

-  Method invocation framework, based on which the `@sensejs/http` handles requests, where the request parameters
   are provided as an injectable and bound to the parameters of the target method. It can also be useful if you
   need to integrate other RPC frameworks with SenseJS.
