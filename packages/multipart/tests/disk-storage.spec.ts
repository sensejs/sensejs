import {MultipartFileDiskStorage} from '../src/disk-storage.js';
import {Readable} from 'stream';
import {MultipartLimitExceededError} from '../src/index.js';
import {AsyncIterableQueue} from '@sensejs/utility';
import crypto from 'crypto';
import {expect} from '@jest/globals';
import {readStreamToBuffer} from './common.js';

describe('MultipartFileDiskStorage', () => {
  test('options', async () => {
    const storage = new MultipartFileDiskStorage({fileSizeLimit: 1024, fileCountLimit: 1});
    expect(storage.fileSizeLimit).toBe(1024);
    expect(storage.fileCountLimit).toBe(1);
  });

  test('should works', async () => {
    const storage = new MultipartFileDiskStorage({fileCountLimit: 1});

    const input1 = Buffer.alloc(1024, 0);
    const input2 = Buffer.alloc(1024, 0);
    crypto.randomFillSync(input1);
    crypto.randomFillSync(input2);
    const result = await storage.saveMultipartFile('file', Readable.from([input1, input2]), {
      filename: 'test.txt',
      transferEncoding: '7bit',
      mimeType: 'text/plain',
    });
    expect(result).toEqual(
      expect.objectContaining({
        type: 'file',
        name: 'file',
        filename: 'test.txt',
        size: input1.length + input2.length,
        mimeType: 'text/plain',
      }),
    );

    const readable = result.body();
    const content = await readStreamToBuffer(readable, result.size);

    expect(content).toEqual(Buffer.concat([input1, input2]));

    await storage.clean();
  });

  test('too many files', async () => {
    const storage = new MultipartFileDiskStorage({fileCountLimit: 1});

    const input = Buffer.alloc(1024, 0);
    expect(
      await storage.saveMultipartFile('file', Readable.from([input]), {
        filename: 'test.txt',
        transferEncoding: '7bit',
        mimeType: 'text/plain',
      }),
    ).toEqual(
      expect.objectContaining({
        type: 'file',
        name: 'file',
        filename: 'test.txt',
        size: 1024,
        mimeType: 'text/plain',
      }),
    );

    await expect(
      storage.saveMultipartFile('file', Readable.from([input]), {
        filename: 'test.txt',
        transferEncoding: '7bit',
        mimeType: 'text/plain',
      }),
    ).rejects.toBeInstanceOf(MultipartLimitExceededError);
    await storage.clean();
  });

  test('file error', async () => {
    const storage = new MultipartFileDiskStorage({fileCountLimit: 1});
    class CustomError extends Error {}
    const queue = new AsyncIterableQueue<Buffer>();
    const readable = Readable.from(queue);
    setImmediate(() => {
      queue.abort(new CustomError());
    });

    await expect(
      storage.saveMultipartFile('file', readable, {
        filename: 'test.txt',
        transferEncoding: '7bit',
        mimeType: 'text/plain',
      }),
    ).rejects.toBeInstanceOf(CustomError);
    await storage.clean();
  });
});
