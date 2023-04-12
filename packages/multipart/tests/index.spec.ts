import {MultipartReader} from '../src/index.js';
import {Readable} from 'stream';
import http from 'http';
import * as net from 'net';
import FormData from 'form-data';

describe('MultipartReader', () => {
  test('should works', async () => {
    return new Promise<void>((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        const stub = jest.fn();

        let error;
        try {
          const reader = new MultipartReader(req, req.headers);
          for await (const entry of reader.read()) {
            stub(entry);
          }

          expect(stub).toBeCalledTimes(3);
          expect(stub).toHaveBeenNthCalledWith(1, {
            type: 'field',
            name: 'field',
            value: 'value',
          });
          expect(stub).toHaveBeenNthCalledWith(2, {
            type: 'file',
            name: 'file',
            filename: 'test.txt',
            content: Buffer.from('Hello World!'),
            size: 12,
            mimeType: 'text/plain',
          });
          expect(stub).toHaveBeenNthCalledWith(3, {
            type: 'field',
            name: 'field2',
            value: 'value2',
          });
        } catch (e) {
          console.error(e);
          error = e;
        }

        if (error) {
          res.statusCode = 500;
          res.end(String(error));
        } else {
          res.statusCode = 200;
          res.end();
        }
      });
      server.listen(0, () => {
        const port = (server.address() as net.AddressInfo).port;

        const formData = new FormData();
        formData.append('field', 'value');
        formData.append('file', Buffer.from('Hello World!'), {filename: 'test.txt', contentType: 'text/plain'});
        formData.append('field2', 'value2');
        formData.submit(`http://localhost:${port}`, (err, res) => {
          server.close();
          if (res.statusCode === 200) {
            resolve();
          } else {
            reject(new Error('test failed'));
          }
        });
      });
    });
  });
});
