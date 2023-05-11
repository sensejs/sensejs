
# The S3 Storage Adaptor for `@sensejs/multipart` (experimental)

This package, `@sensejs/multipart-s3-adaptor`, provides an experimental S3 storage adaptor
for `@sensejs/multipart`, based on the official AWS SDK v3 for Javascript.


## Usage

```typescript
const [multipart, cleanup] = Multipart.from(req, req.headers);

try {
  const records = await multipart.read(new MultipartFileRemoteStorage(new S3StorageAdaptor({
    s3Config: {
      // Your S3 config
    },
    s3Bucket: 'you-s3-bucket-name',
    getFileKey: (name, info) => {
      // Return the key of the file in S3
      return `${maybeSomePrefix}/${name}`;
    },
  })));
} finally {
  // It will invoke the cleanup method provided by your adaptor
  await cleanup();
}
```

Consult documentation comments of `S3StorageAdaptorOptions` for more detail.



