import {MultipartFileDiskStorage} from '../src/disk-storage.js';
import {Readable} from 'stream';
import {MultipartLimitExceededError} from '../src/index.js';
import {EventIterator} from 'event-iterator';

describe('MultipartFileDiskStorage', () => {
  test('options', async () => {
    const storage = new MultipartFileDiskStorage({fileSizeLimit: 1024, fileCountLimit: 1});
    expect(storage.fileSizeLimit).toBe(1024);
    expect(storage.fileCountLimit).toBe(1);
  });

  test('should works', async () => {
    const storage = new MultipartFileDiskStorage({});
    expect(
      await storage.saveMultipartFile('file', Readable.from([Buffer.from('Hello '), Buffer.from('World!')]), {
        filename: 'test.txt',
        transferEncoding: '7bit',
        mimeType: 'text/plain',
      }),
    ).toEqual(
      expect.objectContaining({
        type: 'file',
        name: 'file',
        filename: 'test.txt',
        content: expect.any(Readable),
        size: 12,
        mimeType: 'text/plain',
      }),
    );
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
        content: expect.any(Readable),
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
  });

  test('file error', async () => {
    const storage = new MultipartFileDiskStorage({fileCountLimit: 1});
    class CustomError extends Error {}

    await expect(
      storage.saveMultipartFile(
        'file',
        Readable.from(
          new EventIterator<Buffer>((queue) => {
            setTimeout(() => {
              queue.fail(new CustomError('test'));
            }, 10);
          }),
        ),
        {
          filename: 'test.txt',
          transferEncoding: '7bit',
          mimeType: 'text/plain',
        },
      ),
    ).rejects.toBeInstanceOf(CustomError);
  });
});
