# @sensejs/multipart

## 0.11.0

### Minor Changes

- 78821a2: Introduce experimental multipart support

  This change introduce a new package `@sensejs/multipart` that based on
  `@fastify/busboy` to provide a high level multipart body handling with
  custom storage provider support and back pressure support.

  This package does not depends on the other part of SenseJS, and can be
  used standalong with any other HTTP framwork.

### Patch Changes

- e791242: Introduce AsyncIterableQueue in `@sensejs/utility`, replace `event-iterator` with it in `@sensejs/multipart`
- f426f00: Add missing package.json in dist-cjs and dist-mjs folder
- f3e8daf: Fix README
- Updated dependencies [88a823c]
- Updated dependencies [e791242]
- Updated dependencies [9eecdbf]
- Updated dependencies [15025d4]
  - @sensejs/utility@0.11.0

## 0.11.0-alpha.3

### Patch Changes

- f426f008: Add missing package.json in dist-cjs and dist-mjs folder
- f3e8daf7: Fix README

## 0.11.0-alpha.2

### Minor Changes

- 78821a2a: Introduce experimental multipart support

  This change introduce a new package `@sensejs/multipart` that based on
  `@fastify/busboy` to provide a high level multipart body handling with
  custom storage provider support and back pressure support.

  This package does not depends on the other part of SenseJS, and can be
  used standalong with any other HTTP framwork.
