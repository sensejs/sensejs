import {MultipartFileEntry, MultipartFileStorage, MultipartFileStorageOption} from './types.js';

/**
 *
 */
export class MultipartFileInMemoryStorage extends MultipartFileStorage<Buffer> {
  static readonly fileSizeLimit = 32 * 1024 * 1024;
  static readonly fileCountLimit = 1;
  readonly #fileSizeLimit: number;
  readonly #fileCountLimit: number;

  /**
   * Create a new in-memory storage
   *
   * The default file size limit is 32MB, and the default file count limit is 1, and it should fit
   * the small file upload use case. If you need to handle large file upload, or you need to handle
   * multiple files, you should use other storage implementation instead, as increasing the limits
   * will expose your server to potential denial of service attack.
   *
   */
  constructor(option: MultipartFileStorageOption = {}) {
    super();
    this.#fileSizeLimit = option.fileSizeLimit ?? MultipartFileInMemoryStorage.fileSizeLimit;
    this.#fileCountLimit = option.fileCountLimit ?? MultipartFileInMemoryStorage.fileCountLimit;
  }

  get fileSizeLimit() {
    return this.#fileSizeLimit;
  }

  get fileCountLimit() {
    return 1;
  }

  async clean() {
    // for an in-memory storage, there is nothing to clean
  }

  saveMultipartFile(filename: string, file: NodeJS.ReadableStream): Promise<MultipartFileEntry<Buffer>> {
    return new Promise<MultipartFileEntry<Buffer>>((resolve, reject) => {
      let lastBufferCapacity = 16;
      let buffer: Buffer = Buffer.alloc(Math.min(this.#fileSizeLimit, lastBufferCapacity * 2));
      let size = 0;
      file.on('data', (chunk: Buffer) => {
        if (size + chunk.length > this.#fileSizeLimit) {
          reject(new Error('File too large'));
          return;
        }
        if (size + chunk.length > buffer.length) {
          // Grows the buffer capacity with a fibonacci sequence
          const newCapacity = Math.min(this.#fileSizeLimit, buffer.length + lastBufferCapacity);
          lastBufferCapacity = buffer.length;
          const newBuffers = Buffer.alloc(newCapacity);
          buffer.copy(newBuffers);
          buffer = newBuffers;
        }
        chunk.copy(buffer, size);
        size += chunk.length;
      });

      file.on('end', () => {
        buffer = buffer.slice(0, size);
        resolve({
          type: 'file',
          name: filename,
          filename: filename,
          content: buffer,
          size: size,
        });
      });

      file.on('error', (err: Error) => {
        reject(err);
      });

      if (file.isPaused()) {
        file.resume();
      }
    });
  }
}
