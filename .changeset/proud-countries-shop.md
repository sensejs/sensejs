---
'@sensejs/http-koa-platform': patch
'@sensejs/container': minor
'@sensejs/kafkajs': patch
'@sensejs/core': patch
---

Furthur optimize the MethodInvoker of `@sensejs/container`, though this has to
be a breaking change, it make the MethodInvoker interface simpler, and gains
abount 5% performance improvement.
