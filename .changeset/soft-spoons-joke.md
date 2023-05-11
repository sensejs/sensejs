---
'@sensejs/multipart': patch
---

Redesign the shape of MultipartFileEntry.

It now has a new function member `body()` that returns a Readable;
for MultipartFileInMemoryStorage an additional content field is
presented for accessing the buffer directly, while for
MultipartFileDiskStorage, the content field is deprecated and
will be removed in 0.12
