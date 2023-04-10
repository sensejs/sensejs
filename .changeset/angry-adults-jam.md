---
'@sensejs/config': patch
'@sensejs/container': patch
'@sensejs/core': patch
'@sensejs/http-common': patch
'@sensejs/http-koa-platform': patch
'@sensejs/kafkajs': patch
'@sensejs/kafkajs-standalone': patch
'@sensejs/kafkajs-zstd-support': patch
'@sensejs/logger': patch
'@sensejs/testing': patch
'@sensejs/utility': patch
'@sensejs/testing-utility': patch
---

Fix packages.json for all packages:

- fix incorrect packages exports for `@sensejs/http-koa-platform`
- include CHANGELOG.md when publishing contents to npm registry
