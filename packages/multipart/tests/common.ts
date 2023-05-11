import {expect} from '@jest/globals';
import {Readable} from 'stream';

export async function readStreamToBuffer(readable: Readable, size: number) {
  let offset = 0;
  const content = Buffer.allocUnsafe(size);
  await new Promise<void>((resolve, reject) => {
    readable.on('data', (chunk) => {
      chunk.copy(content, offset);
      offset += chunk.length;
    });
    readable.on('end', () => {
      expect(offset).toBe(size);
      resolve();
    });
    readable.on('error', reject);
  });
  return content;
}
