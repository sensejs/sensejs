import busboy from 'busboy';
import os from 'os';
import fsp from 'fs/promises';
import fs from 'fs';
import stream from 'stream';
import type http from 'http';
import {randomUUID} from 'crypto';
import path from 'path';
import {backpressureAsyncIterator} from './backpressure-async-iterator.js';
import {InvalidMultipartBodyError, MultipartLimitExceededError} from './error.js';
export * from './error.js';

/**
 * A multipart file entry
 */
export interface MultipartFileEntry<Content> {
  type: 'file';
  /**
   * The name of the file field
   */
  name: string;

  /**
   * The filename of the file, provided by the client or browser
   */
  filename: string;

  /**
   * The file content, the type of it depends on the implementation.
   * For the default implementation of in-memory handler, it's a buffer,
   * For the default implementation of file handler, it's a ReadableStream to the file.
   */
  content: Content;

  size: number;
}

export interface MultipartFieldEntry {
  type: 'field';
  /**
   * The name of the field
   */
  name: string;
  /**
   * The value of the field
   */
  value: string;
}

type MultipartEntry<Content> = MultipartFileEntry<Content> | MultipartFieldEntry;

abstract class MultipartFileStorage<Content> {
  abstract readonly fileSizeLimit: number;

  abstract readonly fileCountLimit: number;

  abstract saveMultipartFile(
    filename: string,
    file: NodeJS.ReadableStream,
    info: busboy.FileInfo,
  ): Promise<MultipartFileEntry<Content>>;

  abstract clean(): Promise<void>;
}

export interface MultipartFileStorageOption {
  fileSizeLimit?: number;
  fileCountLimit?: number;
}
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

export interface DistStorageOption extends MultipartFileStorageOption {
  /**
   * The directory to store the uploaded files
   */
  diskDir?: string;

  /**
   * Whether the uploaded files should be removed when cleaning up for current request
   */
  removeFilesOnClean?: boolean;
}

class MultipartFileDiskStorage extends MultipartFileStorage<NodeJS.ReadableStream> {
  static readonly fileSizeLimit = 32 * 1024 * 1024;
  static readonly fileCountLimit = 128;
  readonly #maxFileSize: number;
  readonly #maxFileCount: number;
  readonly #removeFilesOnClean: boolean;
  readonly #dir: string;
  readonly #fds: fsp.FileHandle[] = [];
  #ensureTempDirPromise: Promise<string> | null = null;

  constructor(option: DistStorageOption = {}) {
    super();
    this.#maxFileSize = option.fileSizeLimit ?? MultipartFileDiskStorage.fileSizeLimit;
    this.#maxFileCount = option.fileCountLimit ?? MultipartFileDiskStorage.fileCountLimit;
    this.#dir = option.diskDir ?? os.tmpdir();
    this.#removeFilesOnClean = option.removeFilesOnClean ?? true;
  }

  get fileSizeLimit() {
    return this.#maxFileSize;
  }

  get fileCountLimit() {
    return this.#maxFileCount;
  }

  async saveMultipartFile(
    name: string,
    file: NodeJS.ReadableStream,
    info: busboy.FileInfo,
  ): Promise<MultipartFileEntry<NodeJS.ReadableStream>> {
    const filePath = path.join(await this.#ensureTempDir(), randomUUID());
    return new Promise<MultipartFileEntry<NodeJS.ReadableStream>>((resolve, reject) => {
      const diskFile = fs.createWriteStream(filePath);
      diskFile.on('error', reject);

      diskFile.on('open', () => {
        diskFile.removeListener('error', reject);
        stream.pipeline(file, diskFile, (err) => {
          if (err) {
            reject(err);
          }
          fsp
            .open(filePath, 'r')
            .then((fd) => {
              this.#fds.push(fd);
              return fd.stat().then((stat) => {
                const file = fs.createReadStream(filePath, {
                  fd: fd.fd,
                });
                resolve({
                  type: 'file',
                  name,
                  filename: info.filename,
                  content: file,
                  size: stat.size,
                });
              });
            })
            .catch(reject);
        });
      });
    });
  }

  async clean() {
    await Promise.all(
      this.#fds.map(async (fd) => {
        await fd.close();
      }),
    );
    if (this.#removeFilesOnClean) {
      await fsp.rmdir(await this.#ensureTempDir());
    }
  }

  #ensureTempDir(): Promise<string> {
    if (this.#ensureTempDirPromise !== null) {
      return this.#ensureTempDirPromise;
    }
    this.#ensureTempDirPromise = fsp.mkdtemp(path.join(this.#dir, `${process.pid}-${randomUUID()}`));
    return this.#ensureTempDirPromise;
  }
}

export class MultipartReader {
  static readonly maxFileSize = 16 * 1024 * 1024;
  static readonly maxFileCount = 5;

  // #fileHandler: MultipartFileStorage = new MultipartFileMemoryHandler(MultipartReader.maxFileSize);
  #inputStream: http.IncomingMessage;

  constructor(inputStream: http.IncomingMessage) {
    this.#inputStream = inputStream;
  }

  read(): AsyncIterable<MultipartEntry<Buffer>>;
  read<Content>(handler: MultipartFileStorage<Content>): AsyncIterable<MultipartEntry<Content>>;

  // read(): Promise<AsyncIterator<MultipartEntry<Buffer>>>;
  read(multipartFileHandler?: MultipartFileStorage<any>): AsyncIterable<MultipartEntry<any>> {
    const fileHandler = multipartFileHandler ?? new MultipartFileInMemoryStorage();

    return backpressureAsyncIterator((controller) => {
      const b = busboy({
        headers: this.#inputStream.headers,
        limits: {
          files: fileHandler.fileCountLimit,
          fileSize: fileHandler.fileSizeLimit,
        },
      });
      let promiseQueue: Promise<any> = Promise.resolve();

      b.on('file', (name, file, info) => {
        // We need to invoke `controller.push` immediately to ensure the order of the entries,
        // but we need to wait for previous work to complete before we can handle the file.
        promiseQueue = controller.push(promiseQueue.then(() => fileHandler.saveMultipartFile(name, file, info)));
      });

      b.on('field', (name, value) => {
        promiseQueue = controller.push(
          Promise.resolve({
            type: 'field',
            name,
            value,
          }),
        );
      });

      b.on('partsLimit', () => {
        controller.abort(new MultipartLimitExceededError('Too many parts'));
      });

      b.on('filesLimit', () => {
        controller.abort(new MultipartLimitExceededError('Too many file parts'));
      });

      b.on('fieldsLimit', () => {
        controller.abort(new MultipartLimitExceededError('Too many field parts'));
      });

      b.on('fileSizeLimit', () => {
        controller.abort(new MultipartLimitExceededError('File size limit exceeded'));
      });

      b.on('error', (e) => {
        controller.abort(new InvalidMultipartBodyError(String(e)));
      });

      stream.pipeline(this.#inputStream, b, (err) => {
        if (err) {
          controller.abort(err);
          return;
        }
        controller.finish();
      });
    });
  }
}
