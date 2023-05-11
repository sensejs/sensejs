import S3MockServer from 's3rver';
import * as os from 'os';
import {S3, S3ServiceException} from '@aws-sdk/client-s3';
import {randomBytes, randomUUID} from 'crypto';
import {MultipartFileRemoteStorage} from '@sensejs/multipart';
import {S3StorageAdaptor, S3StorageAdaptorOptions} from '../src/index.js';
import {Readable} from 'stream';
import * as crypto from 'crypto';

describe('MultipartS3Storage', () => {
  let port = 0;
  const getS3Config = () => {
    return {
      endpoint: `http://localhost:${port}`,
      region: 'test',
      credentials: {
        accessKeyId: 'S3RVER',
        secretAccessKey: 'S3RVER',
      },
    };
  };

  function getRemoteStorage(option: Partial<S3StorageAdaptorOptions>) {
    return new MultipartFileRemoteStorage(
      new S3StorageAdaptor({
        s3Bucket: bucket,
        s3Config: getS3Config(),
        getFileKey: (name) => name,
        fileCountLimit: 10,
        fileSizeLimit: 1048576,
        partitionedUploadSizeLimit: 1024,
        simpleUploadSizeLimit: 2048,
        ...option,
      }),
    );
  }

  let mockS3Server: S3MockServer | null = null;
  const bucket = randomUUID();
  beforeAll(() => {
    return new Promise<S3>((resolve, reject) => {
      mockS3Server = new S3MockServer({
        directory: os.tmpdir(),
        port: 0,
        vhostBuckets: true,
        silent: true,
      });
      mockS3Server.run().then((address) => {
        port = address.port;
        resolve(new S3(getS3Config()));
      }, reject);
    }).then((s3Client) => {
      return s3Client
        .createBucket({
          Bucket: bucket,
        })
        .finally(() => {
          return s3Client.destroy();
        });
    });
  });

  afterAll(async () => {
    return new Promise<void>((resolve, reject) => {
      if (mockS3Server) {
        mockS3Server.close((e) => {
          if (e) {
            reject(e);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
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
    const chunks = new Array(3).fill(null).map(() => chunk);
    const content = Buffer.concat(chunks);
    const md5 = crypto.createHash('md5').update(content).digest('base64');
    const storage = getRemoteStorage(option);
    try {
      const result = await storage.saveMultipartFile(md5, Readable.from(chunks), {
        filename: md5,
        transferEncoding: '7bit',
        mimeType: 'application/octet-stream',
      });
      const downloadBuffer = [];

      for await (const chunk of result.body()) {
        downloadBuffer.push(Buffer.from(chunk));
      }

      expect(Buffer.concat(downloadBuffer).length).toEqual(content.length);
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

  test('simple upload', async () => {
    await testSimpleUploadAndDownload({});
  });

  test('partition upload', async () => {
    await testPartitionUploadAndDownload({});
  });
});
