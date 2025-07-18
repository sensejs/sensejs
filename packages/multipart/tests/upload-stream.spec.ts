import {MultipartFileEntry, MultipartFileInfo, RemoteStorageAdaptor, ChecksumCalculator} from '../src/index.js';
import stream, {pipeline, Readable} from 'stream';
import crypto, {Hash, randomUUID} from 'crypto';
import {UploadStream} from '../src/upload-stream.js';
import {jest} from '@jest/globals';

async function readStreamAsBuffer(input: NodeJS.ReadableStream) {
  const buffers: Buffer[] = [];
  for await (const chunk of input) {
    buffers.push(Buffer.from(chunk));
  }
  return Buffer.concat(buffers);
}

const mockFileInfo: MultipartFileInfo = {
  filename: 'bar.txt',
  mimeType: 'text/plain',
  transferEncoding: '7bit',
};

class NoopChecksum implements ChecksumCalculator<null> {
  update(chunk: Buffer): this {
    return this;
  }

  digest(): null {
    return null;
  }
}

async function pipeUploadStream(
  input: NodeJS.ReadableStream,
  adaptor: RemoteStorageAdaptor<any, any, NoopChecksum>,
  name: string,
) {
  const info = {
    filename: 'bar.txt',
    mimeType: 'text/plain',
    transferEncoding: '7bit',
  };
  return new Promise<MultipartFileEntry>((resolve, reject) => {
    pipeline(input, new UploadStream(adaptor, 'foo.txt', mockFileInfo, resolve), (err) => {
      if (err) {
        reject(err);
      }
    });
  });
}

class MockRemoteStorageAdaptor extends RemoteStorageAdaptor<string, string, NoopChecksum> {
  readonly fileCountLimit: number = 10;

  readonly fileSizeLimit: number = 1024;

  readonly files: Map<string, Buffer[]> = new Map();

  readonly partitionUploads: Map<string, Buffer[]> = new Map();

  readonly openedFile = new Map<string, stream.Readable[]>();

  readonly uploadPartitionStub = jest.fn();

  readonly simpleUploadStub = jest.fn();

  readonly beginPartitionedUploadStub = jest.fn();

  readonly finishPartitionedUploadStub = jest.fn();

  readonly bufferSizeLimit;

  constructor(
    readonly simpleUploadSizeLimit: number = 32,
    readonly partitionedUploadSizeLimit: number = 16,
    private consumeDelay: number = 0,
    readonly partitionedUploadChunkLimit: number = 8,
  ) {
    super();
    this.bufferSizeLimit = simpleUploadSizeLimit + partitionedUploadSizeLimit;
  }

  createChecksumCalculator(): NoopChecksum {
    return new NoopChecksum();
  }

  async upload(name: string, buffer: Buffer, info: MultipartFileInfo): Promise<string> {
    this.simpleUploadStub(buffer);
    const id = randomUUID();
    this.files.set(id, [buffer]);
    return id;
  }

  async beginPartitionedUpload(name: string, info: MultipartFileInfo): Promise<string> {
    this.beginPartitionedUploadStub();
    const id = randomUUID();
    this.partitionUploads.set(id, []);
    return id;
  }

  async uploadPartition(pud: string, readable: Readable, size: number): Promise<void> {
    const buffers = this.partitionUploads.get(pud);
    if (!buffers) {
      throw new Error('Invalid pud');
    }
    const chunks: Buffer[] = [];
    if (this.consumeDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.consumeDelay));
    }
    for await (const chunk of readable) {
      chunks.push(chunk);
      this.uploadPartitionStub(chunk);
      if (this.consumeDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.consumeDelay));
      }
    }
    buffers.push(Buffer.concat(chunks));
  }

  async finishPartitionedUpload(partition: string): Promise<string> {
    this.finishPartitionedUploadStub();
    const buffers = this.partitionUploads.get(partition);
    if (!buffers) {
      throw new Error('Invalid pud');
    }
    const id = randomUUID();
    this.files.set(id, buffers);
    return id;
  }

  async abortPartitionedUpload(partition: string): Promise<void> {
    this.partitionUploads.delete(partition);
  }

  createReadStream(fileKey: string): Readable {
    const buffers = this.files.get(fileKey);
    if (!buffers) {
      throw new Error('Invalid file key');
    }

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

function getRandomInputBuffers(size: number, minSize = 1, maxSize = 10) {
  const buffers: Buffer[] = [];
  let totalSize = 0;
  while (totalSize < size) {
    let chunkSize = Math.floor(Math.random() * (maxSize - minSize)) + minSize;
    if (totalSize + chunkSize > size) {
      chunkSize = size - totalSize;
    }
    buffers.push(crypto.randomBytes(chunkSize));
    totalSize += chunkSize;
  }
  return buffers;
}

function getFixedBuffers(size: number, chunkSize = 10) {
  const buffers: Buffer[] = [];
  let totalSize = 0;
  while (totalSize < size) {
    buffers.push(crypto.randomBytes(chunkSize));
    totalSize += chunkSize;
  }
  return buffers;
}

async function* toSlowStreamChunks(buffers: Buffer[]) {
  for (const buffer of buffers) {
    yield buffer;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

describe('UploadStream', () => {
  test('simple upload', async () => {
    const stream = Readable.from(['hello', 'world', '1234567890', '1234567890']);

    const adaptor = new MockRemoteStorageAdaptor();
    const result = await pipeUploadStream(stream, adaptor, 'foo');

    expect(result).toMatchObject({
      filename: mockFileInfo.filename,
      mimeType: mockFileInfo.mimeType,
      transferEncoding: mockFileInfo.transferEncoding,
      size: 30,
    });

    const content = await readStreamAsBuffer(result.body());
    expect(content.toString()).toBe('helloworld12345678901234567890');
  });

  test('multipart upload', async () => {
    const buffers = ['hello', 'world', '1234567890', '1234567890', '1234567890', '1234567890'].map((s) =>
      Buffer.from(s),
    );
    const resultBuffer = Buffer.concat(buffers);
    const stream = Readable.from(buffers);

    const adaptor = new MockRemoteStorageAdaptor();
    const result = await pipeUploadStream(stream, adaptor, 'foo');

    expect(result).toMatchObject({
      filename: mockFileInfo.filename,
      mimeType: mockFileInfo.mimeType,
      transferEncoding: mockFileInfo.transferEncoding,
      size: 50,
    });

    expect(await readStreamAsBuffer(result.body())).toEqual(resultBuffer);

    const slowStream = Readable.from(toSlowStreamChunks(buffers));
    const slowConsumeAdaptor = new MockRemoteStorageAdaptor(45, 40, 1);

    const slowResult = await pipeUploadStream(slowStream, slowConsumeAdaptor, 'foo');
    expect(slowResult).toMatchObject({
      filename: mockFileInfo.filename,
      mimeType: mockFileInfo.mimeType,
      transferEncoding: mockFileInfo.transferEncoding,
      size: 50,
    });

    expect(await readStreamAsBuffer(slowResult.body())).toEqual(resultBuffer);
  });

  test('simple upload error', async () => {
    const stream = Readable.from(['hello', 'world']);
    const adaptor = new MockRemoteStorageAdaptor();
    class CustomError extends Error {}
    adaptor.simpleUploadStub.mockImplementation(() => {
      throw new CustomError('Upload error');
    });

    await expect(() => pipeUploadStream(stream, adaptor, 'foo')).rejects.toThrow(CustomError);
  });

  test('multipart upload error', async () => {
    const stream = Readable.from(['hello', 'world']);
    const adaptor = new MockRemoteStorageAdaptor(8, 8);
    class CustomError extends Error {}
    adaptor.uploadPartitionStub.mockImplementation(() => {
      throw new CustomError('Upload error');
    });
    await expect(() => pipeUploadStream(stream, adaptor, 'foo')).rejects.toThrow(CustomError);
  });

  test('init multipart upload error', async () => {
    const stream = Readable.from(['hello', 'world']);
    const adaptor = new MockRemoteStorageAdaptor(8, 8);
    class CustomError extends Error {}
    adaptor.beginPartitionedUploadStub.mockImplementation(() => {
      throw new CustomError('Upload error');
    });
    await expect(() => pipeUploadStream(stream, adaptor, 'foo')).rejects.toThrow(CustomError);
  });

  test('finish multipart upload error', async () => {
    const stream = Readable.from(['hello', 'world']);
    const adaptor = new MockRemoteStorageAdaptor(8, 8);
    class CustomError extends Error {}
    adaptor.finishPartitionedUploadStub.mockImplementation(() => {
      throw new CustomError('Upload error');
    });
    await expect(() => pipeUploadStream(stream, adaptor, 'foo')).rejects.toThrow(CustomError);
  });

  test('large multipart upload ', async () => {
    const buffers = getFixedBuffers(20);
    const stream = Readable.from(buffers);

    const adaptor = new MockRemoteStorageAdaptor();
    const result = await pipeUploadStream(stream, adaptor, 'foo');

    expect(result).toMatchObject({
      size: Buffer.concat(buffers).length,
    });

    const content = await readStreamAsBuffer(result.body());
    expect(content).toEqual(Buffer.concat(buffers));
  });

  test('large multipart upload, small upload chunk, slow consume', async () => {
    const buffers = getFixedBuffers(200, 40);
    const stream = Readable.from(buffers);

    const adaptor = new MockRemoteStorageAdaptor(50, 5, 1);
    const result = await pipeUploadStream(stream, adaptor, 'foo');

    expect(result).toMatchObject({
      size: Buffer.concat(buffers).length,
    });

    const content = await readStreamAsBuffer(result.body());
    expect(content).toEqual(Buffer.concat(buffers));
  });

  test('large multipart upload, maxSimpleUploadSize=50,, maxPartitionedUploadSize=15', async () => {
    const buffers = getFixedBuffers(200);
    const stream = Readable.from(buffers);

    const adaptor = new MockRemoteStorageAdaptor(50, 15);
    const result = await pipeUploadStream(stream, adaptor, 'foo');

    expect(result).toMatchObject({
      size: Buffer.concat(buffers).length,
    });

    const content = await readStreamAsBuffer(result.body());
    expect(content).toEqual(Buffer.concat(buffers));
  });

  test('large multipart upload, maxSimpleUploadSize=50, maxPartitionedUploadSize=18', async () => {
    const buffers = getFixedBuffers(200);
    const stream = Readable.from(buffers);

    const adaptor = new MockRemoteStorageAdaptor(50, 18);
    const result = await pipeUploadStream(stream, adaptor, 'foo');

    expect(result).toMatchObject({
      size: Buffer.concat(buffers).length,
    });

    const content = await readStreamAsBuffer(result.body());
    expect(content).toEqual(Buffer.concat(buffers));
  });

  test('large multipart upload, slow consume, maxSimpleUploadSize=50, maxPartitionedUploadSize=15', async () => {
    const buffers = getRandomInputBuffers(200);
    const stream = Readable.from(buffers);

    const adaptor = new MockRemoteStorageAdaptor(50, 15, 1);
    const result = await pipeUploadStream(stream, adaptor, 'foo');

    expect(result).toMatchObject({
      size: Buffer.concat(buffers).length,
    });

    const content = await readStreamAsBuffer(result.body());
    expect(content).toEqual(Buffer.concat(buffers));
  });

  test('large multipart upload, slow consume, maxSimpleUploadSize=50, maxPartitionedUploadSize=15', async () => {
    const buffers = getRandomInputBuffers(200);
    const stream = Readable.from(buffers);

    const adaptor = new MockRemoteStorageAdaptor(50, 15, 1);
    const result = await pipeUploadStream(stream, adaptor, 'foo');

    expect(result).toMatchObject({
      size: Buffer.concat(buffers).length,
    });

    const content = await readStreamAsBuffer(result.body());
    expect(content).toEqual(Buffer.concat(buffers));
  });

  test('large multipart upload, slow input, maxSimpleUploadSize=50, maxPartitionedUploadSize=15', async () => {
    const buffers = getRandomInputBuffers(200);
    const stream = Readable.from(toSlowStreamChunks(buffers));

    const adaptor = new MockRemoteStorageAdaptor(50, 15);
    const result = await pipeUploadStream(stream, adaptor, 'foo');

    expect(result).toMatchObject({
      size: Buffer.concat(buffers).length,
    });

    const content = await readStreamAsBuffer(result.body());
    expect(content).toEqual(Buffer.concat(buffers));
  });
  test('large multipart upload, slow input and consume, maxSimpleUploadSize=50, maxPartitionedUploadSize=24', async () => {
    const buffers = getRandomInputBuffers(200);
    const stream = Readable.from(toSlowStreamChunks(buffers));

    const adaptor = new MockRemoteStorageAdaptor(50, 24, 1);
    const result = await pipeUploadStream(stream, adaptor, 'foo');

    expect(result).toMatchObject({
      size: Buffer.concat(buffers).length,
    });

    const content = await readStreamAsBuffer(result.body());
    expect(content).toEqual(Buffer.concat(buffers));
  });

  test('quick fuzzy test', async () => {
    for (let size = 1; size < 256; size += 5) {
      const buffers = getRandomInputBuffers(size);

      const stream = Readable.from(buffers);

      const adaptor = new MockRemoteStorageAdaptor(50, 15);
      const result = await pipeUploadStream(stream, adaptor, 'foo');

      expect(result).toMatchObject({
        size: Buffer.concat(buffers).length,
      });

      const content = await readStreamAsBuffer(result.body());
      expect(content).toEqual(Buffer.concat(buffers));
    }
  });
});
