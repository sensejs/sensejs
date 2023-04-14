---
'@sensejs/multipart': minor
---

Introduce experimental multipart support

This change introduce a new package `@sensejs/multipart` that based on
`@fastify/busboy` to provide a high level multipart body handling with
custom storage provider support and back pressure support.

This package does not depends on the other part of SenseJS, and can be
used standalong with any other HTTP framwork.