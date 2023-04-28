import {RemoteStorageAdaptor} from '../src/remote-storage-adaptor.js';
import {MultipartFileEntry, MultipartFileInfo} from '../src/index.js';
import stream, {pipeline, Readable} from 'stream';
import {randomUUID} from 'crypto';
import {UploadStream} from '../src/upload-stream.js';

async function readStreamAsBuffer(input: NodeJS.ReadableStream) {
  const buffers: Buffer[] = [];
  for await (const chunk of input) {
    buffers.push(Buffer.from(chunk));
  }
  return Buffer.concat(buffers);
}

class MockRemoteStorageAdaptor extends RemoteStorageAdaptor<string, string> {
  readonly fileCountLimit: number = 10;

  readonly fileSizeLimit: number = 1024;

  readonly files: Map<string, Buffer[]> = new Map();

  readonly partitionUploads: Map<string, Buffer[]> = new Map();

  readonly openedFile = new Map<string, stream.Readable[]>();

  constructor(
    readonly maxSimpleUploadSize: number = 32,
    readonly maxPartitionedUploadSize: number = 16,
    private consumeDelay: number = 0,
  ) {
    super();
  }

  async upload(name: string, buffer: Buffer, info: MultipartFileInfo): Promise<string> {
    const id = randomUUID();
    this.files.set(id, [buffer]);
    return id;
  }

  async beginPartitionedUpload(name: string, info: MultipartFileInfo): Promise<string> {
    const id = randomUUID();
    this.partitionUploads.set(id, []);
    return id;
  }

  async uploadPartition(pud: string, readable: Readable, size: number): Promise<void> {
    const buffers = this.partitionUploads.get(pud);
    if (!buffers) throw new Error('Invalid pud');
    const chunks: Buffer[] = [];
    if (this.consumeDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.consumeDelay));
    }
    for await (const chunk of readable) {
      chunks.push(chunk);
      if (this.consumeDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.consumeDelay));
      }
    }
    buffers.push(Buffer.concat(chunks));
  }

  async finishPartitionedUpload(partition: string): Promise<string> {
    const buffers = this.partitionUploads.get(partition);
    if (!buffers) throw new Error('Invalid pud');
    const id = randomUUID();
    this.files.set(id, buffers);
    return id;
  }

  async abortPartitionedUpload(partition: string): Promise<void> {
    this.partitionUploads.delete(partition);
  }

  createReadStream(fileKey: string): NodeJS.ReadableStream {
    const buffers = this.files.get(fileKey);
    if (!buffers) throw new Error('Invalid file key');

    const readable = stream.Readable.from(buffers);
    let opened = this.openedFile.get(fileKey);
    if (!opened) {
      opened = [];
      this.openedFile.set(fileKey, opened);
    }
    opened.push(readable);
    return readable;
  }

  async cleanup() {
    for (const opened of this.openedFile.values()) {
      for (const stream of opened) {
        stream.destroy();
      }
    }
  }
}

function getLargeInputBuffers() {
  const buffers = [
    'hello',
    'world',
    '1234567890',
    '1234567890',
    '1234567890',
    '1234567890',
    '1234567890',
    '1234567890',
    '1234567890',
    '1234567890',
    '1234567890',
    '1234567890',
    '1234567890',
    '1234567890',
    '1234567890',
    '1234567890',
    '1234567890',
    '1234567890',
    '1234567890',
    '1234567890',
    '1234567890',
    '1234567890',
    '1234567890',
    '1234567890',
    '1234567890',
    '1234567890',
  ].map((s) => Buffer.from(s));
  return buffers;
}

async function* getLargeSlowInputBuffers() {
  const buffers = getLargeInputBuffers();
  for (const buffer of buffers) {
    yield buffer;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

describe('UploadStream', () => {
  test('simple upload', async () => {
    const stream = Readable.from(['hello', 'world', '1234567890', '1234567890']);

    const adaptor = new MockRemoteStorageAdaptor();
    const result = await new Promise<MultipartFileEntry<() => NodeJS.ReadableStream>>((resolve, reject) => {
      const uploadStream = new UploadStream(
        adaptor,
        'foo',
        {
          filename: 'bar.txt',
          mimeType: 'text/plain',
          transferEncoding: '7bit',
        },
        resolve,
        reject,
      );

      pipeline(stream, uploadStream, () => {});
    });

    expect(result).toMatchObject({
      filename: 'bar.txt',
      mimeType: 'text/plain',
      transferEncoding: '7bit',
      size: 30,
    });

    const content = await readStreamAsBuffer(result.content());
    expect(content.toString()).toBe('helloworld12345678901234567890');
  });

  test('multipart upload', async () => {
    const stream = Readable.from(['hello', 'world', '1234567890', '1234567890', '1234567890', '1234567890']);

    const adaptor = new MockRemoteStorageAdaptor();
    const result = await new Promise<MultipartFileEntry<() => NodeJS.ReadableStream>>((resolve, reject) => {
      const uploadStream = new UploadStream(
        adaptor,
        'foo',
        {
          filename: 'bar.txt',
          mimeType: 'text/plain',
          transferEncoding: '7bit',
        },
        resolve,
        reject,
      );

      pipeline(stream, uploadStream, () => {});
    });

    expect(result).toMatchObject({
      filename: 'bar.txt',
      mimeType: 'text/plain',
      transferEncoding: '7bit',
      size: 50,
    });

    const content = await readStreamAsBuffer(result.content());
    expect(content.toString()).toBe('helloworld1234567890123456789012345678901234567890');
  });

  test('large multipart upload ', async () => {
    const buffers = getLargeInputBuffers();
    const stream = Readable.from(buffers);

    const adaptor = new MockRemoteStorageAdaptor();
    const result = await new Promise<MultipartFileEntry<() => NodeJS.ReadableStream>>((resolve, reject) => {
      const uploadStream = new UploadStream(
        adaptor,
        'foo',
        {
          filename: 'bar.txt',
          mimeType: 'text/plain',
          transferEncoding: '7bit',
        },
        resolve,
        reject,
      );

      pipeline(stream, uploadStream, () => {});
    });

    expect(result).toMatchObject({
      filename: 'bar.txt',
      mimeType: 'text/plain',
      transferEncoding: '7bit',
      size: Buffer.concat(buffers).length,
    });

    const content = await readStreamAsBuffer(result.content());
    expect(content.toString()).toBe(Buffer.concat(buffers).toString());
  });
  test('large multipart upload, maxSimpleUploadSize=50,, maxPartitionedUploadSize=15', async () => {
    const buffers = getLargeInputBuffers();
    const stream = Readable.from(buffers);

    const adaptor = new MockRemoteStorageAdaptor(50, 15);
    const result = await new Promise<MultipartFileEntry<() => NodeJS.ReadableStream>>((resolve, reject) => {
      const uploadStream = new UploadStream(
        adaptor,
        'foo',
        {
          filename: 'bar.txt',
          mimeType: 'text/plain',
          transferEncoding: '7bit',
        },
        resolve,
        reject,
      );

      pipeline(stream, uploadStream, () => {});
    });

    expect(result).toMatchObject({
      filename: 'bar.txt',
      mimeType: 'text/plain',
      transferEncoding: '7bit',
      size: Buffer.concat(buffers).length,
    });

    const content = await readStreamAsBuffer(result.content());
    expect(content.toString()).toBe(Buffer.concat(buffers).toString());
  });

  test('large multipart upload, maxSimpleUploadSize=50,, maxPartitionedUploadSize=15', async () => {
    const buffers = getLargeInputBuffers();
    const stream = Readable.from(buffers);

    const adaptor = new MockRemoteStorageAdaptor(50, 12);
    const result = await new Promise<MultipartFileEntry<() => NodeJS.ReadableStream>>((resolve, reject) => {
      const uploadStream = new UploadStream(
        adaptor,
        'foo',
        {
          filename: 'bar.txt',
          mimeType: 'text/plain',
          transferEncoding: '7bit',
        },
        resolve,
        reject,
      );

      pipeline(stream, uploadStream, () => {});
    });

    expect(result).toMatchObject({
      filename: 'bar.txt',
      mimeType: 'text/plain',
      transferEncoding: '7bit',
      size: Buffer.concat(buffers).length,
    });

    const content = await readStreamAsBuffer(result.content());
    expect(content.toString()).toBe(Buffer.concat(buffers).toString());
  });

  test('large multipart upload, slow consume, maxSimpleUploadSize=50, maxPartitionedUploadSize=15', async () => {
    const buffers = getLargeInputBuffers();
    const stream = Readable.from(buffers);

    const adaptor = new MockRemoteStorageAdaptor(50, 15, 1);
    const result = await new Promise<MultipartFileEntry<() => NodeJS.ReadableStream>>((resolve, reject) => {
      const uploadStream = new UploadStream(
        adaptor,
        'foo',
        {
          filename: 'bar.txt',
          mimeType: 'text/plain',
          transferEncoding: '7bit',
        },
        resolve,
        reject,
      );

      pipeline(stream, uploadStream, () => {});
    });

    expect(result).toMatchObject({
      filename: 'bar.txt',
      mimeType: 'text/plain',
      transferEncoding: '7bit',
      size: Buffer.concat(buffers).length,
    });

    const content = await readStreamAsBuffer(result.content());
    expect(content.toString()).toBe(Buffer.concat(buffers).toString());
  });

  test('large multipart upload, slow input, maxSimpleUploadSize=50, maxPartitionedUploadSize=15', async () => {
    const buffers = getLargeInputBuffers();
    const stream = Readable.from(getLargeSlowInputBuffers());

    const adaptor = new MockRemoteStorageAdaptor(50, 15);
    const result = await new Promise<MultipartFileEntry<() => NodeJS.ReadableStream>>((resolve, reject) => {
      const uploadStream = new UploadStream(
        adaptor,
        'foo',
        {
          filename: 'bar.txt',
          mimeType: 'text/plain',
          transferEncoding: '7bit',
        },
        resolve,
        reject,
      );

      pipeline(stream, uploadStream, () => {});
    });

    expect(result).toMatchObject({
      filename: 'bar.txt',
      mimeType: 'text/plain',
      transferEncoding: '7bit',
      size: Buffer.concat(buffers).length,
    });

    const content = await readStreamAsBuffer(result.content());
    expect(content.toString()).toBe(Buffer.concat(buffers).toString());
  });
});
