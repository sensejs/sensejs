import {MultipartFileInMemoryStorage, MultipartLimitExceededError} from '../src/index.js';
import {describe, test} from '@jest/globals';
import {Readable} from 'stream';
import {AsyncIterableQueue} from '@sensejs/utility';
import {readStreamToBuffer} from './common.js';

describe('MultipartFileInMemoryStorage', () => {
  test('should works', async () => {
    const storage = new MultipartFileInMemoryStorage();
    const result = await storage.saveMultipartFile(
      'file',
      Readable.from([Buffer.from('Hello '), Buffer.from('World!')]),
      {
        filename: 'test.txt',
        transferEncoding: '7bit',
        mimeType: 'text/plain',
      },
    );
    expect(result).toEqual(
      expect.objectContaining({
        type: 'file',
        name: 'file',
        filename: 'test.txt',
        // content: Buffer.from('Hello World!'),
        size: 12,
        mimeType: 'text/plain',
      }),
    );
    expect(result.content).toEqual(Buffer.from('Hello World!'));
    expect(await readStreamToBuffer(result.body(), result.size)).toEqual(Buffer.from('Hello World!'));
  });

  test('large input', async () => {
    const storage = new MultipartFileInMemoryStorage();
    const input = Buffer.alloc(1024, 0);

    expect(
      await storage.saveMultipartFile('file', Readable.from([input, input, input, input]), {
        filename: 'test.txt',
        transferEncoding: '7bit',
        mimeType: 'text/plain',
      }),
    ).toEqual(
      expect.objectContaining({
        type: 'file',
        name: 'file',
        filename: 'test.txt',
        size: 4096,
        mimeType: 'text/plain',
      }),
    );
  });

  test('should throw error when file is too large', async () => {
    const storage = new MultipartFileInMemoryStorage({
      fileSizeLimit: 1024,
    });
    expect(storage.fileSizeLimit).toBe(1024);
    const input = Buffer.alloc(1024, 0);

    await expect(
      storage.saveMultipartFile('file', Readable.from([input, input, input, input]), {
        filename: 'test.txt',
        transferEncoding: '7bit',
        mimeType: 'text/plain',
      }),
    ).rejects.toBeInstanceOf(MultipartLimitExceededError);
  });

  test('should throw error when file count is too large', async () => {
    const storage = new MultipartFileInMemoryStorage({
      fileCountLimit: 2,
    });
    expect(storage.fileCountLimit).toBe(2);
    await storage.saveMultipartFile('file1', Readable.from([Buffer.from('Hello '), Buffer.from('World!')]), {
      filename: 'test.txt',
      transferEncoding: '7bit',
      mimeType: 'text/plain',
    });
    await storage.saveMultipartFile('file2', Readable.from([Buffer.from('Hello '), Buffer.from('World!')]), {
      filename: 'test.txt',
      transferEncoding: '7bit',
      mimeType: 'text/plain',
    });

    expect(
      storage.saveMultipartFile('file3', Readable.from([Buffer.from('Hello '), Buffer.from('World!')]), {
        filename: 'test.txt',
        transferEncoding: '7bit',
        mimeType: 'text/plain',
      }),
    ).rejects.toBeInstanceOf(MultipartLimitExceededError);
  });

  test('should throw error when file stream errored', async () => {
    const storage = new MultipartFileInMemoryStorage();
    class CustomError extends Error {}
    const queue = new AsyncIterableQueue<Buffer>();
    const readable = Readable.from(queue);
    setImmediate(() => {
      queue.abort(new CustomError());
    });
    await expect(
      storage.saveMultipartFile('file1', readable, {
        filename: 'test.txt',
        transferEncoding: '7bit',
        mimeType: 'text/plain',
      }),
    ).rejects.toBeInstanceOf(CustomError);
  });
});
