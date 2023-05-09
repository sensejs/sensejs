import {MultipartFileEntry, MultipartFileInfo, MultipartFileStorage} from './types.js';
import {pipeline} from 'stream';
import {UploadStream} from './upload-stream.js';
import {RemoteStorageAdaptor} from './remote-storage-adaptor.js';
import {MultipartLimitExceededError} from './error.js';

/**
 * Remote storage for multipart file upload
 *
 * The HTTP multipart file upload does not give a way to know the size of the file until it's fully uploaded,
 * so we have to buffer the content and decide whether to perform a partitioned upload or a simple upload when there
 * is enough content buffered.
 *
 * The overall strategy is, allocating a buffer with size of `max(simpleUploadSizeLimit, partitionedUploadSizeLimit)`,
 * and then fill the buffer until end of stream or the buffer is full. If the file ended before the buffer is full,
 * just perform a simple upload, otherwise we have to perform a partitioned upload.
 *
 */
export class MultipartFileRemoteStorage implements MultipartFileStorage<() => NodeJS.ReadableStream> {
  public readonly fileCountLimit: number;
  public readonly fileSizeLimit: number;
  readonly #adaptor: RemoteStorageAdaptor<any, any, any>;
  #fileCount = 0;

  constructor(adaptor: RemoteStorageAdaptor<any, any, any>) {
    this.#adaptor = adaptor;

    this.fileCountLimit = adaptor.fileCountLimit;

    if (this.fileCountLimit <= 0) {
      throw new Error('Illegal file count limit, must be a positive integer');
    }

    this.fileSizeLimit = adaptor.fileSizeLimit;

    if (this.fileSizeLimit <= 0) {
      throw new Error('Illegal file size limit, must be a positive integer');
    }
  }

  async saveMultipartFile(
    name: string,
    file: NodeJS.ReadableStream,
    info: MultipartFileInfo,
  ): Promise<MultipartFileEntry<() => NodeJS.ReadableStream>> {
    if (this.#fileCount >= this.fileCountLimit) {
      throw new MultipartLimitExceededError('File count limit exceeded');
    }
    this.#fileCount += 1;
    return new Promise<MultipartFileEntry<() => NodeJS.ReadableStream>>((resolve, reject) => {
      const writable = new UploadStream(this.#adaptor, name, info, resolve);
      pipeline(file, writable, (e) => {
        if (e) {
          // istanbul ignore next
          return reject(e);
        }
      });
    });
  }

  async clean() {
    return this.#adaptor.cleanup();
  }
}
