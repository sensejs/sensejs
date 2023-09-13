import {S3, S3ClientConfig, S3ServiceException} from '@aws-sdk/client-s3';
import {randomBytes, randomUUID} from 'crypto';
import {MultipartFileRemoteStorage} from '@sensejs/multipart';
import {S3StorageAdaptor, S3StorageAdaptorOptions} from '../src/index.js';
import {Readable} from 'stream';
import * as crypto from 'crypto';

describe('MultipartS3Storage', () => {
  const getS3Config = (): S3ClientConfig => {
    return {
      endpoint: 'http://minio:9000',
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'minioadmin',
        secretAccessKey: 'minioadmin',
      },
      forcePathStyle: true,
    };
  };
  const bucket = randomUUID();

  function getRemoteStorage(option: Partial<S3StorageAdaptorOptions>) {
    return new MultipartFileRemoteStorage(
      new S3StorageAdaptor({
        s3Bucket: bucket,
        s3Config: getS3Config(),
        getFileKey: (name) => name,
        fileCountLimit: 10,
        partitionedUploadSizeLimit: 5 * 1024 * 1024,
        simpleUploadSizeLimit: 5 * 1024 * 1024,
        ...option,
      }),
    );
  }

  beforeAll(async () => {
    const s3Client = new S3(getS3Config());
    try {
      await s3Client.createBucket({
        Bucket: bucket,
      });
    } finally {
      s3Client.destroy();
    }
  });

  async function testSimpleUploadAndDownload(option: Partial<S3StorageAdaptorOptions>) {
    const content = randomBytes(1024);
    const md5 = crypto.createHash('md5').update(content).digest('base64');
    const storage = getRemoteStorage(option);
    try {
      const result = await storage.saveMultipartFile(md5, Readable.from([content]), {
        filename: md5,
        transferEncoding: '7bit',
        mimeType: 'application/octet-stream',
      });

      const downloadBuffer = [];

      for await (const chunk of result.body()) {
        downloadBuffer.push(Buffer.from(chunk));
      }
      expect(Buffer.concat(downloadBuffer)).toEqual(content);
    } catch (e) {
      if (e instanceof S3ServiceException) {
        console.error(e.name, e.$response, e.$fault, e.$metadata);
      }
      throw e;
    } finally {
      await storage.clean();
    }
  }

  async function testPartitionUploadAndDownload(option: Partial<S3StorageAdaptorOptions>) {
    const chunk = randomBytes(1024);
    const chunks = new Array(8 * 1024).fill(null).map(() => chunk);
    // const content = Buffer.concat(chunks);
    let md5 = crypto.createHash('md5');
    for (const chunk of chunks) {
      md5 = md5.update(chunk);
    }
    const originalMd5 = md5.digest('base64url');
    // const md5 = crypto.createHash('md5').update(content).digest('base64');
    const storage = getRemoteStorage(option);
    try {
      const result = await storage.saveMultipartFile(originalMd5, Readable.from(chunks), {
        filename: originalMd5,
        transferEncoding: '7bit',
        mimeType: 'application/octet-stream',
      });
      let md5 = crypto.createHash('md5');

      for await (const chunk of result.body()) {
        md5 = md5.update(chunk);
      }
      const downloadedMd5 = md5.digest('base64url');

      expect(downloadedMd5).toEqual(originalMd5);
    } catch (e) {
      if (e instanceof S3ServiceException) {
        console.error(e.name, e.$response, e.$fault, e.$metadata);
      }
      throw e;
    } finally {
      await storage.clean();
    }
  }

  test('simple upload', async () => {
    await testSimpleUploadAndDownload({});
  });

  test('partition upload', async () => {
    await testPartitionUploadAndDownload({});
  });
});
