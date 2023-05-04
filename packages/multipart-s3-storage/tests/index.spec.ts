import S3MockServer from 's3rver';
import * as os from 'os';
import {S3} from '@aws-sdk/client-s3';
import {randomBytes, randomUUID} from 'crypto';
import {MultipartFileRemoteStorage} from '@sensejs/multipart';
import {S3StorageAdaptor} from '../src/index.js';
import {Readable} from 'stream';

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

  test('upload', async () => {
    const storage = new MultipartFileRemoteStorage(
      new S3StorageAdaptor({
        s3Bucket: bucket,
        s3Config: getS3Config(),
        getFileKey: (name) => name,
        fileCountLimit: 10,
        fileSizeLimit: 1048576,
        partitionedUploadSizeLimit: 1024,
        partitionedUploadChunkLimit: 32,
        simpleUploadSizeLimit: 1024,
      }),
    );

    const smallInput = randomBytes(1024);
    const largeInputChunks: Buffer[] = new Array(100).fill(randomBytes(1024));

    const smallFileUploadResult = await storage.saveMultipartFile('small', Readable.from([smallInput]), {
      filename: 'small.bin',
      transferEncoding: '7bit',
      mimeType: 'application/octet-stream',
    });

    const smallReadableChunks = [];

    for await (const chunk of smallFileUploadResult.content()) {
      smallReadableChunks.push(Buffer.from(chunk));
    }

    expect(Buffer.concat(smallReadableChunks)).toEqual(smallInput);

    const largeFileUploadResult = await storage.saveMultipartFile('big', Readable.from(largeInputChunks), {
      filename: 'large.bin',
      transferEncoding: '7bit',
      mimeType: 'application/octet-stream',
    });

    const largeReadableChunks = [];
    for await (const chunk of largeFileUploadResult.content()) {
      largeReadableChunks.push(Buffer.from(chunk));
    }

    expect(Buffer.concat(largeReadableChunks)).toEqual(Buffer.concat(largeInputChunks));
  });
});
