import {MultipartFileInfo, RemoteStorageAdaptor} from '@sensejs/multipart';
import * as stream from 'stream';
import {Readable} from 'stream';
import {CreateMultipartUploadCommandOutput, S3, S3ClientConfig} from '@aws-sdk/client-s3';
import * as crypto from 'crypto';

const DEFAULT_SIMPLE_UPLOAD_SIZE_LIMIT = 32 * 1024 * 1024;
const DEFAULT_PARTITIONED_UPLOAD_SIZE_LIMIT = 16 * 1024 * 1024;
const DEFAULT_FILE_COUNT_LIMIT = 1024;
const S3_MULTIPART_UPLOAD_PART_COUNT_LIMIT = 10000;

export interface S3StorageAdaptorOptions {
  s3Config: S3ClientConfig;
  s3Bucket: string;
  /**
   * Maximum number of files allowed to upload allowed per request
   */
  fileCountLimit?: number;
  /**
   * Maximum size of a file
   *
   * Default to 10000 * partitionedUploadSizeLimit(default to 16MB)
   * where 10000 is the maximum number of parts allowed by a S3 multipart upload.
   */
  fileSizeLimit?: number;

  /**
   * Maximum size of a file that will be uploaded using simple upload
   *
   * @default 32 * 1024 * 1024
   *
   * A file larger than this size will be uploaded using partitioned upload
   */
  simpleUploadSizeLimit?: number;

  /**
   * Maximum partition size
   *
   * @default 16 * 1024 * 1024
   */
  partitionedUploadSizeLimit?: number;

  /**
   * Size of buffer used to sponge the file content, should be greater than
   * `max(simpleUploadSizeLimit, partitionedUploadSizeLimit)`
   *
   * @default 40 * 1024 * 1024
   */
  bufferSizeLimit?: number;

  /**
   * The function to generate the key of the file to be uploaded
   * @param name
   * @param fileInfo
   */
  getFileKey: (name: string, fileInfo: MultipartFileInfo) => string;
}

interface S3MultipartUploadState {
  fileKey: string;
  multipartOutput: CreateMultipartUploadCommandOutput;
  partNumber: number;
  uploadId: string;
  eTags: string[];
}

export class S3StorageAdaptor extends RemoteStorageAdaptor<string, S3MultipartUploadState, crypto.Hash> {
  readonly fileCountLimit: number;
  readonly fileSizeLimit: number;
  readonly bufferSizeLimit: number;
  readonly partitionedUploadSizeLimit: number;
  readonly simpleUploadSizeLimit: number;
  readonly #s3Client: S3;
  readonly #s3Config: S3ClientConfig;
  readonly #s3Bucket: string;
  readonly #getFileKey: (name: string, fileInfo: MultipartFileInfo) => string;
  readonly #openedStreams = new Set<Readable>();

  constructor(options: S3StorageAdaptorOptions) {
    super();
    this.simpleUploadSizeLimit = options.simpleUploadSizeLimit ?? DEFAULT_SIMPLE_UPLOAD_SIZE_LIMIT;
    this.partitionedUploadSizeLimit = options.partitionedUploadSizeLimit ?? DEFAULT_PARTITIONED_UPLOAD_SIZE_LIMIT;
    this.bufferSizeLimit =
      options.bufferSizeLimit ?? Math.max(this.simpleUploadSizeLimit, this.partitionedUploadSizeLimit);
    this.fileCountLimit = options.fileCountLimit ?? DEFAULT_FILE_COUNT_LIMIT;
    this.fileSizeLimit =
      options.fileSizeLimit ?? S3_MULTIPART_UPLOAD_PART_COUNT_LIMIT * this.partitionedUploadSizeLimit;
    this.#s3Config = options.s3Config;
    this.#s3Bucket = options.s3Bucket;
    this.#getFileKey = options.getFileKey;
    this.#s3Client = new S3({
      ...options.s3Config,
    });
  }

  async abortPartitionedUpload(pud: S3MultipartUploadState): Promise<void> {
    await this.#s3Client.abortMultipartUpload({
      Bucket: this.#s3Bucket,
      Key: pud.fileKey,
      UploadId: pud.uploadId,
    });
  }

  async beginPartitionedUpload(name: string, info: MultipartFileInfo): Promise<S3MultipartUploadState> {
    const fileKey = this.#getFileKey(name, info);
    const multipartOutput = await this.#s3Client.createMultipartUpload({
      Bucket: this.#s3Bucket,
      Key: fileKey,
      ContentType: info.mimeType,
    });

    return {
      fileKey,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      uploadId: multipartOutput.UploadId!,
      multipartOutput,
      partNumber: 1,
      eTags: [],
    };
  }

  createChecksumCalculator(): crypto.Hash {
    return crypto.createHash('md5');
  }

  async cleanup(): Promise<void> {
    for (const stream of this.#openedStreams) {
      stream.destroy();
    }
    this.#s3Client.destroy();
  }

  createReadStream(key: string): NodeJS.ReadableStream {
    const result = new stream.PassThrough();
    this.#s3Client.getObject({Bucket: this.#s3Bucket, Key: key}).then(
      (response) => {
        stream.pipeline(response.Body as stream.Readable, result, (err) => {
          if (err) {
            result.destroy(err);
          }
        });
      },
      (e) => {
        result.destroy(e);
      },
    );
    this.#openedStreams.add(result);
    return result;
  }

  async finishPartitionedUpload(pud: S3MultipartUploadState): Promise<string> {
    await this.#s3Client.completeMultipartUpload({
      Bucket: this.#s3Bucket,
      Key: pud.fileKey,
      UploadId: pud.uploadId,
      MultipartUpload: {
        Parts: pud.eTags.map((eTag, index) => ({
          ETag: eTag,
          PartNumber: index + 1,
        })),
      },
    });
    return pud.fileKey;
  }

  async upload(name: string, buffer: Buffer, info: MultipartFileInfo): Promise<string> {
    const key = this.#getFileKey(name, info);
    const checksumCalculator = this.createChecksumCalculator();
    const checksum = checksumCalculator?.update(buffer).digest().toString('base64') ?? null;
    const checksumOptions = typeof checksum === 'string' ? {ContentMD5: checksum} : {};
    await this.#s3Client.putObject({
      Bucket: this.#s3Bucket,
      Key: key,
      Body: buffer,
      ContentLength: buffer.length,
      ...checksumOptions,
    });
    return key;
  }

  async uploadPartition(
    pud: S3MultipartUploadState,
    readable: Readable,
    size: number,
    checksumCalculator: crypto.Hash,
  ): Promise<void> {
    const partNumber = pud.partNumber++;

    const checksum = checksumCalculator.digest().toString('base64');
    const result = await this.#s3Client.uploadPart({
      Bucket: this.#s3Bucket,
      Key: pud.fileKey,
      UploadId: pud.uploadId,
      Body: readable,
      PartNumber: partNumber,
      ContentLength: size,
      ContentMD5: checksum,
    });
    // eslint-disable-next-line
    pud.eTags.push(result.ETag!);
  }
}
