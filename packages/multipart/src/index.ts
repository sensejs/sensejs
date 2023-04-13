import busboy from '@fastify/busboy';
import stream from 'stream';
import type http from 'http';
import {backpressureAsyncIterator} from './backpressure-async-iterator.js';
import {InvalidMultipartBodyError, MultipartLimitExceededError} from './error.js';
import {MultipartEntry, MultipartFileStorage} from './types.js';
import {MultipartFileInMemoryStorage} from './in-memory-storage.js';

export * from './error.js';
export * from './in-memory-storage.js';
export * from './disk-storage.js';
export * from './types.js';

export interface MultipartReaderOptions {
  /**
   * The maximum size of a file, in bytes.
   * Note this is only implemented for x-www-form-urlencoded, and for multipart/form-data it's noop.
   *
   * see: https://github.com/fastify/busboy/blob/9e24edce01d56aa011105750a25c15cb88813d53/lib/types/multipart.js#L3
   */
  fieldNameLimit?: number;

  /**
   * The maximum number of fields
   */
  fieldCountLimit?: number;

  /**
   * The maximum size of a field, in bytes.
   */
  fieldSizeLimit?: number;

  /**
   * The maximum number of parts
   */
  partCountLimit?: number;
}

export class MultipartReader {
  static readonly maxFileSize = 16 * 1024 * 1024;
  static readonly maxFileCount = 5;

  // #fileHandler: MultipartFileStorage = new MultipartFileMemoryHandler(MultipartReader.maxFileSize);
  readonly #inputStream: stream.Readable;
  readonly #headers: busboy.BusboyHeaders;
  readonly #options: MultipartReaderOptions;

  constructor(inputStream: stream.Readable, headers: http.IncomingHttpHeaders, option: MultipartReaderOptions = {}) {
    this.#inputStream = inputStream;
    if (typeof headers['content-type'] !== 'string') {
      throw new InvalidMultipartBodyError('Missing Content-Type header');
    }
    this.#headers = headers as busboy.BusboyHeaders;
    this.#options = option;
  }

  read(): AsyncIterable<MultipartEntry<Buffer>>;
  read<Content>(handler: MultipartFileStorage<Content>): AsyncIterable<MultipartEntry<Content>>;

  // read(): Promise<AsyncIterator<MultipartEntry<Buffer>>>;
  read(multipartFileHandler?: MultipartFileStorage<any>): AsyncIterable<MultipartEntry<any>> {
    const fileHandler = multipartFileHandler ?? new MultipartFileInMemoryStorage();

    return backpressureAsyncIterator((controller) => {
      const limits = {
        fieldNameSize: this.#options.fieldNameLimit,
        files: fileHandler.fileCountLimit,
        fileSize: fileHandler.fileSizeLimit,
        fields: this.#options.fieldCountLimit,
        fieldSize: this.#options.fieldSizeLimit,
        parts: this.#options.partCountLimit,
      };
      const b = busboy.default({
        headers: this.#headers,
        limits,
      });
      let promiseQueue: Promise<any> = Promise.resolve();

      b.on('file', (name, file, filename, transferEncoding, mimeType) => {
        // We need to invoke `controller.push` immediately to ensure the order of the entries,
        // but we need to wait for previous work to complete before we can handle the file.
        promiseQueue = promiseQueue.then(() => {
          return controller.push(
            fileHandler.saveMultipartFile(name, file, {
              filename,
              transferEncoding,
              mimeType,
            }),
          );
        });
      });

      b.on('field', (name, value, fieldNameTruncated, valueTruncated, transferEncoding, mimeType) => {
        if (fieldNameTruncated) {
          controller.abort(new MultipartLimitExceededError('Field name size limit exceeded'));
        }

        if (valueTruncated) {
          controller.abort(new MultipartLimitExceededError('Field value size limit exceeded'));
        }

        promiseQueue = promiseQueue.then(() => {
          return controller.push(
            Promise.resolve({
              type: 'field',
              name,
              value,
              transferEncoding,
              mimeType,
            }),
          );
        });
      });

      b.on('finish', () => {
        promiseQueue = promiseQueue.then(() => {
          controller.finish();
        });
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

      b.on('error', (e) => {
        controller.abort(new InvalidMultipartBodyError(String(e)));
      });

      stream.pipeline(this.#inputStream, b, (err) => {
        if (err) {
          controller.abort(err);
          return;
        }
      });
    });
  }
}
