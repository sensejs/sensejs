import {MultipartFileEntry, MultipartFileStorage, MultipartFileStorageOption} from './types.js';
import fsp from 'fs/promises';
import os from 'os';
import busboy from 'busboy';
import path from 'path';
import {randomUUID} from 'crypto';
import fs from 'fs';
import stream from 'stream';

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

class MultipartFileDiskStorage extends MultipartFileStorage<NodeJS.ReadableStream> {
  static readonly fileSizeLimit = 32 * 1024 * 1024;
  static readonly fileCountLimit = 128;
  readonly #maxFileSize: number;
  readonly #maxFileCount: number;
  readonly #removeFilesOnClean: boolean;
  readonly #dir: string;
  readonly #fds: fsp.FileHandle[] = [];
  #ensureTempDirPromise: Promise<string> | null = null;

  constructor(option: DiskStorageOption = {}) {
    super();
    this.#maxFileSize = option.fileSizeLimit ?? MultipartFileDiskStorage.fileSizeLimit;
    this.#maxFileCount = option.fileCountLimit ?? MultipartFileDiskStorage.fileCountLimit;
    this.#dir = option.diskDir ?? os.tmpdir();
    this.#removeFilesOnClean = option.removeFilesOnClean ?? true;
  }

  get fileSizeLimit() {
    return this.#maxFileSize;
  }

  get fileCountLimit() {
    return this.#maxFileCount;
  }

  async saveMultipartFile(
    name: string,
    file: NodeJS.ReadableStream,
    info: busboy.FileInfo,
  ): Promise<MultipartFileEntry<NodeJS.ReadableStream>> {
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
              this.#fds.push(fd);
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
      this.#fds.map(async (fd) => {
        await fd.close();
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
