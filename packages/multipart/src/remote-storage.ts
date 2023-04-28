import {MultipartFileEntry, MultipartFileInfo, MultipartFileStorage} from './types.js';
import {pipeline} from 'stream';
import {UploadStream} from './upload-stream.js';
import {RemoteStorageAdaptor} from './remote-storage-adaptor.js';

export interface RemoteStorageOption {
  /**
   * The maximum file size can be uploaded using `RemoteStorageAdaptor.upload`
   */
  maxSimpleUploadFileSize?: number;
  /**
   * The maximum partition size can be uploaded using `RemoteStorageAdaptor.uploadPartition`
   */
  partitionedUploadBufferSize?: number;

  fileCountLimit?: number;

  fileSizeLimit?: number;
}

/**
 * Remote storage for multipart file upload
 *
 * The HTTP multipart file upload does not give a way to know the size of the file until it's fully uploaded,
 * so we have to buffer the content and decide whether to perform a partitioned upload or a simple upload when there
 * is enough content buffered.
 *
 * The overall strategy is, allocating a buffer with size of `max(maxSimpleUploadSize, maxPartitionedUploadSize)`,
 * and then fill the buffer until end of stream or the buffer is full. If the file ended before the buffer is full,
 * just perform a simple upload, otherwise we have to perform a partitioned upload.
 *
 */
export class RemoteStorage implements MultipartFileStorage<() => NodeJS.ReadableStream> {
  private readonly adaptor: RemoteStorageAdaptor<any, any>;
  private saveFilePromise: Promise<void> | null = null;
  public readonly fileCountLimit: number;
  public readonly fileSizeLimit: number;
  private readonly maxSimpleUploadSize;
  private readonly maxPartitionedUploadSize;
  private fileCount = 0;

  constructor(adaptor: RemoteStorageAdaptor<any, any>, option: RemoteStorageOption = {}) {
    this.adaptor = adaptor;
    this.maxSimpleUploadSize = adaptor.maxSimpleUploadSize;
    if (this.maxSimpleUploadSize <= 0) {
      throw new Error('Illegal max simple upload size, must be a positive integer');
    }

    this.maxPartitionedUploadSize = adaptor.maxPartitionedUploadSize;

    if (this.maxPartitionedUploadSize <= 0) {
      throw new Error('Illegal max partitioned upload size, must be a positive integer');
    }

    this.fileCountLimit = adaptor.fileSizeLimit;

    if (this.fileCountLimit <= 0) {
      throw new Error('Illegal file count limit, must be a positive integer');
    }

    this.fileSizeLimit = adaptor.fileCountLimit;

    if (this.fileSizeLimit <= 0) {
      throw new Error('Illegal file size limit, must be a positive integer');
    }
  }

  async saveMultipartFile(
    name: string,
    file: NodeJS.ReadableStream,
    info: MultipartFileInfo,
  ): Promise<MultipartFileEntry<() => NodeJS.ReadableStream>> {
    return new Promise<MultipartFileEntry<() => NodeJS.ReadableStream>>((resolve, reject) => {
      const writable = new UploadStream(this.adaptor, name, info, resolve);
      pipeline(file, writable, (e) => {
        if (e) {
          return reject(e);
        }
      });
    });
  }

  async clean() {
    return this.adaptor.cleanup();
  }
}
