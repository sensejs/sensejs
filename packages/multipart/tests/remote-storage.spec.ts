import {describe, expect, test} from '@jest/globals';
import fsp from 'fs/promises';
import {MultipartFileInfo, MultipartFileRemoteStorage, RemoteStorageAdaptor} from '../src/index.js';
import {Readable} from 'stream';
import fs from 'fs';
import crypto, {Hash, randomUUID} from 'crypto';
import os from 'os';
import path from 'path';

/**
 * We don't want to use a real remote storage in unit test, use a mock implementation
 * that stores files in local filesystem instead.
 */
class MockRemoteStorageAdaptor extends RemoteStorageAdaptor<string, fsp.FileHandle> {
  fileCountLimit: number = 10;
  fileSizeLimit: number = 1024;
  partitionedUploadChunkLimit: number = 128;
  partitionedUploadSizeLimit: number = 1024;
  simpleUploadSizeLimit: number = 1024;

  private filenameToPathMap: Map<string, string> = new Map(); // filename -> filepath
  private fileHandleToPathMap: WeakMap<fsp.FileHandle, string> = new WeakMap();
  private tempDir = os.tmpdir();
  private openedFiles: Set<fs.ReadStream> = new Set();

  async abortPartitionedUpload(pud: fsp.FileHandle): Promise<void> {
    const filePath = this.fileHandleToPathMap.get(pud);
    await pud.close();
    if (filePath) {
      await fsp.rm(filePath);
    }
  }

  createChecksumCalculator(): Hash | null {
    return crypto.createHash('crc32c');
  }

  async beginPartitionedUpload(name: string, info: MultipartFileInfo): Promise<fsp.FileHandle> {
    const filePath = path.join(this.tempDir, randomUUID());
    // this.filenameToPathMap.set(name, filePath);
    const fileHandle = await fsp.open(filePath, 'w');
    this.fileHandleToPathMap.set(fileHandle, filePath);
    return fileHandle;
  }

  async cleanup(): Promise<void> {
    for (const file of this.openedFiles) {
      await file.close();
    }
    for (const filePath of this.filenameToPathMap.values()) {
      await fsp.rm(filePath);
    }
  }

  createReadStream(file: string): NodeJS.ReadableStream {
    const stream = fs.createReadStream(file);
    this.openedFiles.add(stream);
    return stream;
  }

  async finishPartitionedUpload(pud: fsp.FileHandle): Promise<string> {
    const filePath = this.fileHandleToPathMap.get(pud);
    if (!filePath) {
      throw new Error('File not found');
    }
    return filePath;
  }

  async upload(name: string, buffer: Buffer, info: MultipartFileInfo): Promise<string> {
    const filePath = path.join(this.tempDir, randomUUID());
    this.filenameToPathMap.set(name, filePath);
    await fsp.writeFile(filePath, buffer);
    return filePath;
  }

  async uploadPartition(
    pud: fsp.FileHandle,
    readable: Readable,
    size: number,
    checksumCalculator: Hash | null,
  ): Promise<void> {
    const precalculatedChecksum = checksumCalculator?.digest('base64') ?? null;
    const checksumCalculator2 = this.createChecksumCalculator();
    for await (const chunk of readable) {
      checksumCalculator2?.update(chunk);
      await pud.write(chunk);
    }
    const checksum = checksumCalculator2?.digest('base64') ?? null;
    expect(checksum).toEqual(precalculatedChecksum);
  }
}

describe('RemoteStorage', () => {
  test('option check', () => {
    const badAdapter = new MockRemoteStorageAdaptor();
    badAdapter.fileCountLimit = 0;
    expect(() => new MultipartFileRemoteStorage(badAdapter)).toThrowError();
    badAdapter.fileCountLimit = 10;
    badAdapter.fileSizeLimit = 0;
    expect(() => new MultipartFileRemoteStorage(badAdapter)).toThrowError();
    badAdapter.fileSizeLimit = 1024;
    badAdapter.partitionedUploadSizeLimit = 0;
    expect(() => new MultipartFileRemoteStorage(badAdapter)).toThrowError();
    badAdapter.partitionedUploadSizeLimit = 1024;
    badAdapter.simpleUploadSizeLimit = 0;
    expect(() => new MultipartFileRemoteStorage(badAdapter)).toThrowError();
  });
  test('upload', async () => {
    const content = crypto.randomBytes(1024);
    const input = [content.slice(0, 256), content.slice(256, 512), content.slice(512, 768), content.slice(768, 1024)];

    const storage = new MultipartFileRemoteStorage(new MockRemoteStorageAdaptor());
    const result = await storage.saveMultipartFile('file', Readable.from(input), {
      filename: 'test.txt',
      transferEncoding: '7bit',
      mimeType: 'text/plain',
    });
    expect(result).toEqual(
      expect.objectContaining({
        type: 'file',
        name: 'file',
        filename: 'test.txt',
        transferEncoding: '7bit',
        size: 1024,
        mimeType: 'text/plain',
      }),
    );
    const chunks: Buffer[] = [];
    for await (const chunk of result.content()) {
      chunks.push(Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks)).toEqual(content);
    await storage.clean();
  });
});