import {MultipartFileInfo} from './types.js';
import {Readable} from 'stream';

/**
 * A remote storage adaptor
 *
 * @template F The file descriptor type for uploaded file
 * @template P The partition descriptor type for partitioned upload
 */
export abstract class RemoteStorageAdaptor<F extends {}, P extends {}> {
  /**
   * The maximum file size can be uploaded using `RemoteStorageAdaptor.upload`,
   * file larger than this size must be uploaded using partitioned upload
   */
  abstract readonly maxSimpleUploadSize: number;

  /**
   * The maximum partition size can be uploaded using `RemoteStorageAdaptor.uploadPartition`
   */
  abstract readonly maxPartitionedUploadSize: number;

  /**
   * The maximum number of files can be uploaded for each instance of `RemoteStorageAdaptor`
   */
  abstract readonly fileCountLimit: number;

  /**
   * The maximum file size supported by the remote storage
   */
  abstract readonly fileSizeLimit: number;

  /**
   * Upload a file to the remote storage
   * @param name
   * @param buffer
   * @param info
   */
  abstract upload(name: string, buffer: Buffer, info: MultipartFileInfo): Promise<F>;

  /**
   * Initiate a partitioned upload for a file
   * @param name
   * @param info
   */
  abstract beginPartitionedUpload(name: string, info: MultipartFileInfo): Promise<P>;

  /**
   * Upload a partition of a file to the remote storage
   * @param pud The partitioned upload descriptor returned by `beginPartitionedUpload`
   * @param readable The readable stream of this partition
   * @param size The size of this partition
   */
  abstract uploadPartition(pud: P, readable: Readable, size: number): Promise<void>;

  /**
   * Finish a partitioned upload
   * @param pud The partitioned upload descriptor returned by `beginPartitionedUpload`
   */
  abstract finishPartitionedUpload(pud: P): Promise<F>;

  /**
   * Abort a partitioned upload
   * @param pud The partitioned upload descriptor returned by `beginPartitionedUpload`
   */
  abstract abortPartitionedUpload(pud: P): Promise<void>;

  abstract createReadStream(file: F): NodeJS.ReadableStream;

  abstract cleanup(): Promise<void>;
}
