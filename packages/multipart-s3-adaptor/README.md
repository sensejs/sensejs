
# The S3 Storage Adaptor for `@sensejs/multipart` (experimental)

This package, `@sensejs/multipart-s3-adaptor`, provides an experimental S3 storage adaptor
for `@sensejs/multipart`, based on the official AWS SDK v3 for Javascript.


## Usage

```typescript

const [multipart, cleanup] = Multipart.from(req, req.headers);

try {
  const records = await multipart.read(new MultipartFileDiskStorage());
} finally {
  // By default, files stored by `MultipartFileDiskStorage` will be deleted when calling cleanup
  await cleanup();
}

```
If your app cannot access disk storage, and you only need to handle small files,
you can just call `await multipart.read()` instead, which will by default to
an instance of `MultipartFileMemoryStorage` that stores files in memory.

If you want to handle large files and persist them on a remote storage, you should
implement a custom storage adaptor that derives from `RemoteStorageAdaptor`, and
use it with `MultipartFileRemoteStorage`.

```typescript

const [multipart, cleanup] = Multipart.from(req, req.headers);

try {
  const records = await multipart.read(new MultipartFileRemoteStorage(new YourRemoteStorageAdaptor()));
} finally {
  // It will invoke the cleanup method provided by your adaptor
  await cleanup();
}
```

