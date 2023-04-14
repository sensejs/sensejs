
# High-level Multipart Body Parser

This package, `@sensejs/multipart`, provides a high-level multipart body parser
based on `@fastify/busboy` that supports custom storage provider and back
pressure. It does not depend on any other part of SenseJS, and can be used
standalone with any other HTTP framework.


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
implement a custom storage provider that implements `MultipartFileStorage`, and
it may look like this:

```typescript


class RemoteStorage implements MultipartFileStorage<() => Promise<stream.Readable>> {
  async saveMultipartFile(name: string,
                          file: NodeJS.ReadableStream,
                          info: MultipartFileInfo): Promise<MultipartFileEntry<()=> Promsie<NodeJS.ReadableStream>>> {

    // Upload file to a remote storage, e.g.. S3
    const storageId = await uploadToRemoteStorageSomehow(file);
    return {
      // Unlike memory storage or disk storage that save content on local, creating a readable stream
      // for it can be expensive, so it would be better to provide a lazy loading function instead.
      content: async () => {
        // Creating a readable stream on demand
        const yourStream = await createRemoteStorageStreamSomeHow(storageId);

        // Don't forget to add such stream to cleanup list, it would be better not to rely on
        // end user to do cleanup
        this.cleanupList.push(yourStream);

        return yourStream;
      },
      type: 'file',
      name,
      filename: info.filename,

      size: someSize,
      mimeType: info.mimeType,
      transferEncoding: info.transferEncoding,
    };
  }
  async cleanup(file: MultipartFile): Promise<void> {

    // Cleanup all streams created by this storage, otherwises they will leak
    for (const stream of this.cleanupList) {
      stream.destroy();
    }

  }
}

```

