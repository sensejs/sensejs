import {MultipartFileEntry, MultipartFileInfo, MultipartFileStorage, MultipartFileStorageOption} from './types.js';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import {randomUUID} from 'crypto';
import fs from 'fs';
import stream from 'stream';
import {MultipartLimitExceededError} from './error.js';

export interface DiskStorageOption extends MultipartFileStorageOption {
  /**
   * The directory to store the uploaded files
   */
  diskDir?: string;

  /**
   * Whether the uploaded files should be removed when cleaning up for current request
   */
  removeFilesOnClean?: boolean;
}

export class MultipartFileDiskStorage extends MultipartFileStorage<NodeJS.ReadableStream> {
  static readonly fileSizeLimit = 32 * 1024 * 1024;
  static readonly fileCountLimit = 128;
  readonly #fileSizeLimit: number;
  readonly #fileCountLimit: number;
  readonly #removeFilesOnClean: boolean;
  readonly #dir: string;
  readonly #fileEntries: {fd: fsp.FileHandle; filePath: string}[] = [];
  #fileCount = 0;
  #ensureTempDirPromise: Promise<string> | null = null;

  constructor(option: DiskStorageOption = {}) {
    super();
    this.#fileSizeLimit = option.fileSizeLimit ?? MultipartFileDiskStorage.fileSizeLimit;
    this.#fileCountLimit = option.fileCountLimit ?? MultipartFileDiskStorage.fileCountLimit;
    this.#dir = option.diskDir ?? os.tmpdir();
    this.#removeFilesOnClean = option.removeFilesOnClean ?? true;
  }

  get fileSizeLimit() {
    return this.#fileSizeLimit;
  }

  get fileCountLimit() {
    return this.#fileCountLimit;
  }

  async saveMultipartFile(
    name: string,
    file: NodeJS.ReadableStream,
    info: MultipartFileInfo,
  ): Promise<MultipartFileEntry<NodeJS.ReadableStream>> {
    if (this.#fileCount++ >= this.#fileCountLimit) {
      throw new MultipartLimitExceededError('Too many files');
    }
    const filePath = path.join(await this.#ensureTempDir(), randomUUID());
    return new Promise<MultipartFileEntry<NodeJS.ReadableStream>>((resolve, reject) => {
      const diskFile = fs.createWriteStream(filePath);
      diskFile.on('error', reject);

      diskFile.on('open', () => {
        diskFile.removeListener('error', reject);
        stream.pipeline(file, diskFile, (err) => {
          if (err) {
            reject(err);
          }
          fsp
            .open(filePath, 'r')
            .then((fd) => {
              this.#fileEntries.push({fd, filePath});
              return fd.stat().then((stat) => {
                const file = fs.createReadStream(filePath, {
                  fd: fd.fd,
                });
                resolve({
                  type: 'file',
                  name,
                  filename: info.filename,
                  content: file,
                  size: stat.size,
                  mimeType: info.mimeType,
                  transferEncoding: info.transferEncoding,
                });
              });
            })
            .catch(reject);
        });
      });
    });
  }

  async clean() {
    await Promise.all(
      this.#fileEntries.map(async (entry) => {
        await entry.fd.close();
        if (this.#removeFilesOnClean) {
          await fsp.rm(entry.filePath);
        }
      }),
    );
    if (this.#removeFilesOnClean) {
      await fsp.rmdir(await this.#ensureTempDir());
    }
  }

  #ensureTempDir(): Promise<string> {
    if (this.#ensureTempDirPromise !== null) {
      return this.#ensureTempDirPromise;
    }
    this.#ensureTempDirPromise = fsp.mkdtemp(path.join(this.#dir, `${process.pid}-${randomUUID()}`));
    return this.#ensureTempDirPromise;
  }
}
