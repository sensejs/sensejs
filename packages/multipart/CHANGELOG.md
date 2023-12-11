# @sensejs/multipart

## 0.11.3

### Patch Changes

- e7847b1: Update @fastify/busboy

## 0.11.2

### Patch Changes

- 201a479: Introduce `MultipartFileRemoteStorage` and `RemoteStorageAdaptor`.
- eb45ba5: Redesign the shape of MultipartFileEntry.

  It now has a new function member `body()` that returns a Readable;
  for MultipartFileInMemoryStorage an additional content field is
  presented for accessing the buffer directly, while for
  MultipartFileDiskStorage, the content field is deprecated and
  will be removed in 0.12

## 0.11.1

### Patch Changes

- d027c77: Fix a bug that the files not removed on clean up if orror occurred

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
