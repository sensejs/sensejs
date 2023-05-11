import {MultipartFileEntry, MultipartFileInfo, MultipartFileStorage, MultipartFileStorageOption} from './types.js';
import {MultipartLimitExceededError} from './error.js';
import {Readable} from 'stream';

export interface InMemoryMultipartFileEntry extends MultipartFileEntry {
  content: Buffer;
}
/**
 *
 */
export class MultipartFileInMemoryStorage extends MultipartFileStorage<InMemoryMultipartFileEntry> {
  static readonly fileSizeLimit = 32 * 1024 * 1024;
  static readonly fileCountLimit = 1;
  readonly #fileSizeLimit: number;
  readonly #fileCountLimit: number;
  #fileCount = 0;

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
    return this.#fileCountLimit;
  }

  async clean() {
    // for an in-memory storage, there is nothing needs to be cleaned
  }

  saveMultipartFile(
    name: string,
    file: NodeJS.ReadableStream,
    info: MultipartFileInfo,
  ): Promise<InMemoryMultipartFileEntry> {
    if (this.#fileCount++ >= this.#fileCountLimit) {
      return Promise.reject(new MultipartLimitExceededError('Too many files'));
    }
    return new Promise<InMemoryMultipartFileEntry>((resolve, reject) => {
      let lastBufferCapacity = 16;
      let buffer: Buffer = Buffer.alloc(Math.min(this.#fileSizeLimit, lastBufferCapacity * 2));
      let size = 0;
      file.on('data', (chunk: Buffer) => {
        if (size + chunk.length > this.#fileSizeLimit) {
          reject(new MultipartLimitExceededError('File too large'));
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
          name,
          filename: info.filename,
          content: buffer,
          body: () => Readable.from([buffer]),
          size: size,
          mimeType: info.mimeType,
          transferEncoding: info.transferEncoding,
        });
      });

      file.on('error', (err: Error) => {
        reject(err);
      });

      file.resume();
    });
  }
}
