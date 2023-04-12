import busboy from 'busboy';
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

export class MultipartReader {
  static readonly maxFileSize = 16 * 1024 * 1024;
  static readonly maxFileCount = 5;

  // #fileHandler: MultipartFileStorage = new MultipartFileMemoryHandler(MultipartReader.maxFileSize);
  readonly #inputStream: stream.Readable;
  readonly #headers: http.IncomingHttpHeaders;

  constructor(inputStream: stream.Readable, headers: http.IncomingHttpHeaders) {
    this.#inputStream = inputStream;
    this.#headers = headers;
  }

  read(): AsyncIterable<MultipartEntry<Buffer>>;
  read<Content>(handler: MultipartFileStorage<Content>): AsyncIterable<MultipartEntry<Content>>;

  // read(): Promise<AsyncIterator<MultipartEntry<Buffer>>>;
  read(multipartFileHandler?: MultipartFileStorage<any>): AsyncIterable<MultipartEntry<any>> {
    const fileHandler = multipartFileHandler ?? new MultipartFileInMemoryStorage();

    return backpressureAsyncIterator((controller) => {
      const b = busboy({
        headers: this.#headers,
        limits: {
          files: fileHandler.fileCountLimit,
          fileSize: fileHandler.fileSizeLimit,
        },
      });
      let promiseQueue: Promise<any> = Promise.resolve();

      b.on('file', (name, file, info) => {
        // We need to invoke `controller.push` immediately to ensure the order of the entries,
        // but we need to wait for previous work to complete before we can handle the file.
        promiseQueue = promiseQueue.then(() => {
          return controller.push(fileHandler.saveMultipartFile(name, file, info));
        });
      });

      b.on('field', (name, value) => {
        promiseQueue = promiseQueue.then(() => {
          return controller.push(
            Promise.resolve({
              type: 'field',
              name,
              value,
            }),
          );
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
