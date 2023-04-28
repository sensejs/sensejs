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
      const writable = new UploadStream(this.adaptor, name, info, resolve, reject);
      pipeline(file, writable);
    });
  }

  async clean() {
    return this.adaptor.cleanup();
  }
}
