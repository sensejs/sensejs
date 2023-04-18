import busboy from '@fastify/busboy';
import stream from 'stream';
import type http from 'http';
import {AsyncIterableQueue} from '@sensejs/utility';
import {InvalidMultipartBodyError, MultipartLimitExceededError} from './error.js';
import {MultipartEntry, MultipartFileStorage} from './types.js';
import {MultipartFileInMemoryStorage} from './in-memory-storage.js';

export * from './error.js';
export * from './in-memory-storage.js';
export * from './disk-storage.js';
export * from './types.js';

export interface MultipartOptions {
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

export class Multipart {
  static readonly maxFileSize = 16 * 1024 * 1024;
  static readonly maxFileCount = 5;

  // #fileHandler: MultipartFileStorage = new MultipartFileMemoryHandler(MultipartReader.maxFileSize);
  private readonly inputStream: stream.Readable;
  private readonly headers: busboy.BusboyHeaders;
  private readonly options: MultipartOptions;
  private promiseQueue: Promise<any> = Promise.resolve();
  private cleanup: (() => Promise<void>) | null = null;

  protected constructor(
    inputStream: stream.Readable,
    headers: http.IncomingHttpHeaders,
    option: MultipartOptions = {},
  ) {
    this.inputStream = inputStream;
    if (typeof headers['content-type'] !== 'string') {
      throw new InvalidMultipartBodyError('Missing Content-Type header');
    }
    this.headers = headers as busboy.BusboyHeaders;
    this.options = option;
  }

  static testContentType(contentType: string) {
    // RFC 7231 Section 3.1.1.1 Media Type
    // media-type = type "/" subtype *( OWS ";" OWS parameter )
    // We need to take care about optional whitespace around semicolon
    return /^multipart\/form-data(\s*;.+)?$/i.test(contentType);
  }

  /**
   * Create a Multipart instance and associated cleanup function for a given http body stream and headers
   *
   * The cleanup function must be called when the multipart instance is no longer needed, otherwise leaks will occur.
   * The reason not to make the cleanup function part of the Multipart instance is to make it possible to for a
   * framework not to exposes it to end user to prevent from misuse.
   *
   * @param inputStream
   * @param headers
   * @param option
   */
  static from(
    inputStream: stream.Readable,
    headers: http.IncomingHttpHeaders,
    option: MultipartOptions = {},
  ): [Multipart, () => Promise<void>] {
    const multipart = new Multipart(inputStream, headers, option);
    const cleanup = multipart.destroy.bind(multipart);
    return [multipart, cleanup];
  }

  read(): Promise<Record<string, MultipartEntry<any>>>;
  read<Content>(handler: MultipartFileStorage<Content>): Promise<Record<string, MultipartEntry<any>>>;

  async read(handler?: MultipartFileStorage<any>): Promise<Record<string, MultipartEntry<any>>> {
    const result: Record<string, MultipartEntry<any>> = {};
    for await (const entry of this.entries()) {
      result[entry.name] = entry;
    }
    return result;
  }

  entries(): AsyncIterable<MultipartEntry<Buffer>>;
  entries<Content>(handler: MultipartFileStorage<Content>): AsyncIterable<MultipartEntry<Content>>;

  // read(): Promise<AsyncIterator<MultipartEntry<Buffer>>>;
  entries(multipartFileHandler?: MultipartFileStorage<any>): AsyncIterable<MultipartEntry<any>> {
    if (this.cleanup) {
      throw new Error('Cannot read multipart body twice');
    }

    const fileHandler = multipartFileHandler ?? new MultipartFileInMemoryStorage();

    this.cleanup = () => {
      return fileHandler.clean();
    };
    const queue = new AsyncIterableQueue<MultipartEntry<any>>();

    const limits = {
      fieldNameSize: this.options.fieldNameLimit,
      files: fileHandler.fileCountLimit,
      fileSize: fileHandler.fileSizeLimit,
      fields: this.options.fieldCountLimit,
      fieldSize: this.options.fieldSizeLimit,
      parts: this.options.partCountLimit,
    };
    const b = busboy.default({
      headers: this.headers,
      limits,
    });

    b.on('file', (name, file, filename, transferEncoding, mimeType) => {
      // We need to invoke `controller.push` immediately to ensure the order of the entries,
      // but we need to wait for previous work to complete before we can handle the file.
      this.promiseQueue = this.promiseQueue.then(() => {
        return queue.push(
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
        queue.abort(new MultipartLimitExceededError('Field name size limit exceeded'));
      }

      if (valueTruncated) {
        queue.abort(new MultipartLimitExceededError('Field value size limit exceeded'));
      }

      this.promiseQueue = this.promiseQueue.then(() => {
        return queue.push(
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
      this.promiseQueue = this.promiseQueue.then(() => {
        queue.finish();
      });
    });

    b.on('partsLimit', () => {
      queue.abort(new MultipartLimitExceededError('Too many parts'));
    });

    b.on('filesLimit', () => {
      queue.abort(new MultipartLimitExceededError('Too many file parts'));
    });

    b.on('fieldsLimit', () => {
      queue.abort(new MultipartLimitExceededError('Too many field parts'));
    });

    b.on('error', (e) => {
      queue.abort(new InvalidMultipartBodyError(String(e)));
    });

    stream.pipeline(this.inputStream, b, (err) => {
      if (err) {
        queue.abort(err);
        return;
      }
    });
    return queue;
  }

  private async destroy() {
    await this.promiseQueue;
    if (this.cleanup) {
      await this.cleanup();
    }
  }
}
