---
'@sensejs/http-common': minor
---

A new decorator `MultipartBody` was introduced in `@sensejs/http-common`,
which requires the request body to be `multipart/formdata`, and an instance
of `Multipart` from `@sensejs/multipart` will be injected for handling the
request body.
