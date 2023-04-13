import {MultipartFileInMemoryStorage, MultipartLimitExceededError, Multipart} from '../src/index.js';
import stream from 'stream';
import http from 'http';
import * as net from 'net';
import FormData from 'form-data';
import {jest, describe, test} from '@jest/globals';
import {EventIterator} from 'event-iterator';

async function createStubHttpServer(cb: http.RequestListener) {
  return new Promise<http.Server>((resolve, reject) => {
    const server = http.createServer(cb);
    server.on('error', reject);
    server.listen(0, () => {
      server.removeListener('error', reject);
      resolve(server);
    });
  });
}

async function iterateRequests(httpServer: http.Server) {
  return new EventIterator<{req: http.IncomingMessage; res: http.ServerResponse}>((queue) => {
    httpServer.on('request', (req, res) => {
      queue.push({
        req,
        res,
      });
    });
    httpServer.on('close', () => {
      queue.stop();
    });
  });
}
async function streamToString(stream: stream.Readable) {
  // lets have a ReadableStream as a stream variable
  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf-8');
}

describe('MultipartReader', () => {
  const stub = jest.fn();
  const serverPromise = createStubHttpServer(async (req, res) => {
    const reader = new Multipart(req, req.headers, {
      fieldCountLimit: 4,
      fieldSizeLimit: 16,
      partCountLimit: 5,
      fieldNameLimit: 10,
    });
    try {
      for await (const entry of reader.read(
        new MultipartFileInMemoryStorage({
          fileSizeLimit: 16,
          fileCountLimit: 2,
        }),
      )) {
        stub(entry);
      }
    } catch (err) {
      if (err instanceof MultipartLimitExceededError) {
        res.statusCode = 413;
        res.end(err.message);
        return;
      }
      console.error(err);
      res.statusCode = 500;
      res.end(String(err));
      return;
    } finally {
      await reader.destroy();
    }
    res.statusCode = 200;
    res.end('OK');
  });
  let url = '';
  beforeAll(async () => {
    const server = await serverPromise;
    url = `http://localhost:${(server.address() as net.AddressInfo).port}`;
  });
  afterAll(() => {
    serverPromise.then((server) => {
      server.close();
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should works', async () => {
    await new Promise<void>((resolve, reject) => {
      const formData = new FormData();
      formData.append('field', 'value');
      formData.append('file', Buffer.from('Hello World!'), {filename: 'test.txt', contentType: 'text/plain'});
      formData.append('field2', 'value2');
      formData.submit(url, async (err, res) => {
        if (err) {
          return reject(err);
        }
        if (res.statusCode === 200) {
          expect(await streamToString(res)).toBe('OK');
          resolve();
        } else {
          reject(new Error('MultipartReader test failed'));
        }
      });
    });

    expect(stub).toBeCalledTimes(3);
    expect(stub).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'field',
        name: 'field',
        value: 'value',
      }),
    );
    expect(stub).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: 'file',
        name: 'file',
        filename: 'test.txt',
        content: Buffer.from('Hello World!'),
        size: 12,
        mimeType: 'text/plain',
      }),
    );
    expect(stub).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        type: 'field',
        name: 'field2',
        value: 'value2',
      }),
    );
  });

  test('Field count limit exceeded', async () => {
    await new Promise<void>((resolve, reject) => {
      const formData = new FormData();
      formData.append('field1', 'value');
      formData.append('field2', 'value');
      formData.append('field3', 'value');
      formData.append('field4', 'value');
      formData.append('field5', 'value');
      formData.submit(url, async (err, res) => {
        if (res.statusCode === 413) {
          expect(await streamToString(res)).toBe('Too many field parts');
          resolve();
        } else {
          reject(new Error('Field count limit test failed'));
        }
      });
    });
  });

  test('File count limit exceeded', async () => {
    await new Promise<void>((resolve, reject) => {
      const formData = new FormData();
      formData.append('file1', Buffer.from('Hello World!'), {filename: 'test.txt', contentType: 'text/plain'});
      formData.append('file2', Buffer.from('Hello World!'), {filename: 'test.txt', contentType: 'text/plain'});
      formData.append('file3', Buffer.from('Hello World!'), {filename: 'test.txt', contentType: 'text/plain'});
      formData.submit(url, async (err, res) => {
        if (res.statusCode === 413) {
          expect(await streamToString(res)).toBe('Too many file parts');
          resolve();
        } else {
          reject(new Error('File count limit test failed'));
        }
      });
    });
  });

  test('Part count limit exceeded', async () => {
    await new Promise<void>((resolve, reject) => {
      const formData = new FormData();
      formData.append('field1', 'value');
      formData.append('field2', 'value');
      formData.append('field3', 'value');
      formData.append('field4', 'value');
      formData.append('file1', Buffer.from('Hello World!'), {filename: 'test.txt', contentType: 'text/plain'});
      formData.append('file2', Buffer.from('Hello World!'), {filename: 'test.txt', contentType: 'text/plain'});
      formData.submit(url, async (err, res) => {
        if (res.statusCode === 413) {
          expect(await streamToString(res)).toBe('Too many parts');
          resolve();
        } else {
          reject(new Error('Part count limit test failed'));
        }
      });
    });
  });

  test('Field value size limit exceeded', async () => {
    // Field value size limit exceeded
    await new Promise<void>((resolve, reject) => {
      const formData = new FormData();
      formData.append('field1', 'very very long value');
      formData.submit(url, async (err, res) => {
        if (res.statusCode === 413) {
          expect(await streamToString(res)).toBe('Field value size limit exceeded');
          resolve();
        } else {
          reject(new Error('Field value size limit test failed'));
        }
      });
    });
  });

  test.skip('Field name size limit exceeded', async () => {
    await new Promise<void>((resolve, reject) => {
      const formData = new FormData();
      formData.append('veryVeryLongFieldName', 'value', {contentType: 'application/x-www-form-urlencoded'});
      formData.submit(url, async (err, res) => {
        console.log(res.statusCode);
        if (res.statusCode === 413) {
          expect(await streamToString(res)).toBe('Field name size limit exceeded');
          resolve();
        } else {
          reject(new Error('field name size limit test failed'));
        }
      });
    });
  });

  test('Detect content type', () => {
    expect(Multipart.testContentType('application/x-www-form-urlencoded')).toBeFalsy();
    expect(Multipart.testContentType('multipart/form-data')).toBeTruthy();
    expect(Multipart.testContentType('multipart/form-data; boundary=aBoundaryString')).toBeTruthy();
    expect(Multipart.testContentType('multipart/form-data;boundary=aBoundaryString')).toBeTruthy();
    expect(Multipart.testContentType('multipart/form-data ;boundary=aBoundaryString')).toBeTruthy();
    expect(Multipart.testContentType('multipart/form-data ; boundary=aBoundaryString')).toBeTruthy();
  });
});
