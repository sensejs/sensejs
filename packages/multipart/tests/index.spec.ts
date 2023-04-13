import {MultipartFileInMemoryStorage, MultipartLimitExceededError, MultipartReader} from '../src/index.js';
import stream from 'stream';
import http from 'http';
import * as net from 'net';
import FormData from 'form-data';
import {jest, describe, test} from '@jest/globals';
import {EventIterator} from 'event-iterator';

async function createStubHttpServer() {
  return new Promise<http.Server>((resolve, reject) => {
    const server = http.createServer();
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
  test('should works', async () => {
    const server = await createStubHttpServer();

    setImmediate(async () => {
      try {
        const port = (server.address() as net.AddressInfo).port;

        await new Promise<void>((resolve, reject) => {
          const formData = new FormData();
          formData.append('field', 'value');
          formData.append('file', Buffer.from('Hello World!'), {filename: 'test.txt', contentType: 'text/plain'});
          formData.append('field2', 'value2');
          formData.submit(`http://localhost:${port}`, async (err, res) => {
            if (res.statusCode === 200) {
              expect(await streamToString(res)).toBe('OK');
              resolve();
            } else {
              reject(new Error('MultipartReader test failed'));
            }
          });
        });

        // Field count limit exceeded
        await new Promise<void>((resolve, reject) => {
          const formData = new FormData();
          formData.append('field1', 'value');
          formData.append('field2', 'value');
          formData.append('field3', 'value');
          formData.append('field4', 'value');
          formData.append('field5', 'value');
          formData.submit(`http://localhost:${port}`, async (err, res) => {
            if (res.statusCode === 413) {
              expect(await streamToString(res)).toBe('Too many field parts');
              resolve();
            } else {
              reject(new Error('Field count limit test failed'));
            }
          });
        });
        // File count limit exceeded
        await new Promise<void>((resolve, reject) => {
          const formData = new FormData();
          formData.append('file1', Buffer.from('Hello World!'), {filename: 'test.txt', contentType: 'text/plain'});
          formData.append('file2', Buffer.from('Hello World!'), {filename: 'test.txt', contentType: 'text/plain'});
          formData.append('file3', Buffer.from('Hello World!'), {filename: 'test.txt', contentType: 'text/plain'});
          formData.submit(`http://localhost:${port}`, async (err, res) => {
            if (res.statusCode === 413) {
              expect(await streamToString(res)).toBe('Too many file parts');
              resolve();
            } else {
              reject(new Error('File count limit test failed'));
            }
          });
        });

        // Part count limit exceeded
        await new Promise<void>((resolve, reject) => {
          const formData = new FormData();
          formData.append('field1', 'value');
          formData.append('field2', 'value');
          formData.append('field3', 'value');
          formData.append('field4', 'value');
          formData.append('file1', Buffer.from('Hello World!'), {filename: 'test.txt', contentType: 'text/plain'});
          formData.append('file2', Buffer.from('Hello World!'), {filename: 'test.txt', contentType: 'text/plain'});
          formData.submit(`http://localhost:${port}`, async (err, res) => {
            if (res.statusCode === 413) {
              expect(await streamToString(res)).toBe('Too many parts');
              resolve();
            } else {
              reject(new Error('Part count limit test failed'));
            }
          });
        });

        // Field value size limit exceeded
        await new Promise<void>((resolve, reject) => {
          const formData = new FormData();
          formData.append('field1', 'very very long value');
          formData.submit(`http://localhost:${port}`, async (err, res) => {
            if (res.statusCode === 413) {
              expect(await streamToString(res)).toBe('Field value size limit exceeded');
              resolve();
            } else {
              reject(new Error('Field value size limit test failed'));
            }
          });
        });

        // Field name size limit exceeded
        await new Promise<void>((resolve, reject) => {
          const formData = new FormData();
          formData.append('veryVeryLongFieldName', 'value', {contentType: 'application/x-www-form-urlencoded'});
          formData.submit(`http://localhost:${port}`, async (err, res) => {
            console.log(res.statusCode);
            if (res.statusCode === 413) {
              expect(await streamToString(res)).toBe('Field name size limit exceeded');
              resolve();
            } else {
              reject(new Error('field name size limit test failed'));
            }
          });
        });
      } catch (e) {
        console.error(e);
      } finally {
        server.close();
      }
    });
    const stubs = [];

    for await (const {req, res} of await iterateRequests(server)) {
      const stub = jest.fn();
      stubs.push(stub);
      try {
        const reader = new MultipartReader(req, req.headers, {
          fieldCountLimit: 4,
          fieldSizeLimit: 16,
          partCountLimit: 5,
          fieldNameLimit: 10,
        });
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
          continue;
        }
        console.error(err);
        res.statusCode = 500;
        res.end(String(err));
        continue;
      }
      res.statusCode = 200;
      res.end('OK');
    }

    expect(stubs[0]).toBeCalledTimes(3);
    expect(stubs[0]).toHaveBeenNthCalledWith(1, {
      type: 'field',
      name: 'field',
      value: 'value',
    });
    expect(stubs[0]).toHaveBeenNthCalledWith(2, {
      type: 'file',
      name: 'file',
      filename: 'test.txt',
      content: Buffer.from('Hello World!'),
      size: 12,
      mimeType: 'text/plain',
    });
    expect(stubs[0]).toHaveBeenNthCalledWith(3, {
      type: 'field',
      name: 'field2',
      value: 'value2',
    });
  });
});
