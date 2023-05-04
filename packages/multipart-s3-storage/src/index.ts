import {MultipartFileInfo, RemoteStorageAdaptor} from '@sensejs/multipart';
import * as stream from 'stream';
import {Readable} from 'stream';
import {CreateMultipartUploadCommandOutput, S3, S3ClientConfig} from '@aws-sdk/client-s3';

const DEFAULT_SIMPLE_UPLOAD_SIZE_LIMIT = 32 * 1024 * 1024;
const DEFAULT_PARTITIONED_UPLOAD_SIZE_LIMIT = 16 * 1024 * 1024;
const DEFAULT_PARTITIONED_UPLOAD_CHUNK_LIMIT = 4096;

export interface S3StorageAdaptorOptions {
  s3Config: S3ClientConfig;
  s3Bucket: string;
  fileCountLimit: number;
  fileSizeLimit: number;
  simpleUploadSizeLimit?: number;
  partitionedUploadSizeLimit?: number;
  partitionedUploadChunkLimit?: number;
  getFileKey: (name: string, fileInfo: MultipartFileInfo) => string;
}

interface S3MultipartUploadState {
  fileKey: string;
  multipartOutput: CreateMultipartUploadCommandOutput;
  partNumber: number;
  uploadId: string;
  eTags: string[];
}

export class S3StorageAdaptor extends RemoteStorageAdaptor<string, S3MultipartUploadState> {
  readonly fileCountLimit: number;
  readonly fileSizeLimit: number;
  readonly partitionedUploadSizeLimit: number;
  readonly partitionedUploadChunkLimit: number;
  readonly simpleUploadSizeLimit: number;
  private readonly s3Client: S3;
  private readonly s3Config: S3ClientConfig;
  private readonly s3Bucket: string;
  private readonly getFileKey: (name: string, fileInfo: MultipartFileInfo) => string;
  private readonly openedStreams = new Set<Readable>();

  constructor(options: S3StorageAdaptorOptions) {
    super();
    this.fileCountLimit = options.fileCountLimit;
    this.fileSizeLimit = options.fileSizeLimit;
    this.simpleUploadSizeLimit = options.simpleUploadSizeLimit ?? DEFAULT_SIMPLE_UPLOAD_SIZE_LIMIT;
    this.partitionedUploadSizeLimit = options.partitionedUploadChunkLimit ?? DEFAULT_PARTITIONED_UPLOAD_SIZE_LIMIT;
    this.partitionedUploadChunkLimit = options.partitionedUploadChunkLimit ?? DEFAULT_PARTITIONED_UPLOAD_CHUNK_LIMIT;
    this.s3Config = options.s3Config;
    this.s3Bucket = options.s3Bucket;
    this.getFileKey = options.getFileKey;
    this.s3Client = new S3({
      ...options.s3Config,
    });
  }

  async abortPartitionedUpload(pud: S3MultipartUploadState): Promise<void> {
    await this.s3Client.abortMultipartUpload({
      Bucket: this.s3Bucket,
      Key: pud.fileKey,
      UploadId: pud.uploadId,
    });
  }

  async beginPartitionedUpload(name: string, info: MultipartFileInfo): Promise<S3MultipartUploadState> {
    const fileKey = this.getFileKey(name, info);
    const multipartOutput = await this.s3Client.createMultipartUpload({Bucket: this.s3Bucket, Key: fileKey});

    return {
      fileKey,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      uploadId: multipartOutput.UploadId!,
      multipartOutput,
      partNumber: 1,
      eTags: [],
    };
  }

  async cleanup(): Promise<void> {
    for (const stream of this.openedStreams) {
      stream.destroy();
    }
    this.s3Client.destroy();
  }

  createReadStream(key: string): NodeJS.ReadableStream {
    const result = new stream.PassThrough();
    this.s3Client.getObject({Bucket: this.s3Bucket, Key: key}).then(
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
    this.openedStreams.add(result);
    return result;
  }

  async finishPartitionedUpload(pud: S3MultipartUploadState): Promise<string> {
    await this.s3Client.completeMultipartUpload({
      Bucket: this.s3Bucket,
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
    const key = this.getFileKey(name, info);
    await this.s3Client.putObject({
      Bucket: this.s3Bucket,
      Key: key,
      Body: buffer,
    });
    return key;
  }

  async uploadPartition(pud: S3MultipartUploadState, readable: Readable, size: number): Promise<void> {
    const partNumber = pud.partNumber++;
    const result = await this.s3Client.uploadPart({
      Bucket: this.s3Bucket,
      Key: pud.fileKey,
      UploadId: pud.uploadId,
      Body: readable,
      PartNumber: partNumber,
      ContentLength: size,
    });
    pud.eTags.push(result.ETag!);
  }
}
