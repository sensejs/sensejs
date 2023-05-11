import {MultipartFileEntry, MultipartFileInfo, MultipartFileStorage, MultipartFileStorageOption} from './types.js';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import {randomUUID} from 'crypto';
import stream from 'stream';
import {promisify} from 'util';
import {MultipartLimitExceededError} from './error.js';

export interface LegacyMultipartFieldEntry extends MultipartFileEntry {
  /**
   * @deprecated Use `body` instead
   */
  content: NodeJS.ReadableStream;
}

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

export class MultipartFileDiskStorage extends MultipartFileStorage<LegacyMultipartFieldEntry> {
  static readonly fileSizeLimit = 32 * 1024 * 1024;
  static readonly fileCountLimit = 128;
  readonly fileSizeLimit: number;
  readonly fileCountLimit: number;
  private readonly removeFilesOnClean: boolean;
  private readonly dir: string;
  private readonly fileEntries: {fd: fsp.FileHandle; filePath: string}[] = [];
  private fileCount = 0;
  private ensureTempDirPromise: Promise<string> | null = null;

  constructor(option: DiskStorageOption = {}) {
    super();
    this.fileSizeLimit = option.fileSizeLimit ?? MultipartFileDiskStorage.fileSizeLimit;
    this.fileCountLimit = option.fileCountLimit ?? MultipartFileDiskStorage.fileCountLimit;
    this.dir = option.diskDir ?? os.tmpdir();
    this.removeFilesOnClean = option.removeFilesOnClean ?? true;
  }

  async saveMultipartFile(
    name: string,
    file: NodeJS.ReadableStream,
    info: MultipartFileInfo,
  ): Promise<LegacyMultipartFieldEntry> {
    if (this.fileCount++ >= this.fileCountLimit) {
      throw new MultipartLimitExceededError('Too many files');
    }
    const filePath = path.join(await this.#ensureTempDir(), randomUUID());
    let fdForClose: fsp.FileHandle | null = null;
    try {
      const fd = await fsp.open(filePath, 'wx+');
      fdForClose = fd;
      let size = 0;
      await promisify(stream.pipeline)(
        file,
        new stream.Writable({
          write(chunk, encoding, callback) {
            fd.write(chunk, null, encoding).then(() => {
              size += chunk.length;
              callback();
            }, callback);
          },
        }),
      );
      // Once we successfully write the file, we need to prevent it from being closed here, instead, it should be added
      // to the fileEntries then it will be closed on cleaning up
      fdForClose = null;
      this.fileEntries.push({fd, filePath});
      let offset = 0;
      const readable = new stream.Readable({
        read(size) {
          const buffer = Buffer.allocUnsafe(size);
          fd.read(buffer, 0, buffer.length, offset).then(
            ({bytesRead}) => {
              offset += bytesRead;
              if (bytesRead === 0) {
                this.push(null);
              } else {
                this.push(buffer.slice(0, bytesRead));
              }
            },
            (e) => {
              this.destroy(e);
            },
          );
        },
      });
      return {
        type: 'file',
        name,
        filename: info.filename,
        content: readable,
        body: () => readable,
        size,
        mimeType: info.mimeType,
        transferEncoding: info.transferEncoding,
      };
    } finally {
      if (fdForClose !== null) {
        await fdForClose.close();
        await fsp.rm(filePath);
      }
    }
  }

  async clean() {
    await Promise.all(
      this.fileEntries.map(async (entry) => {
        await entry.fd.close();
        if (this.removeFilesOnClean) {
          await fsp.rm(entry.filePath);
        }
      }),
    );
    if (this.removeFilesOnClean) {
      await fsp.rmdir(await this.#ensureTempDir());
    }
  }

  #ensureTempDir(): Promise<string> {
    if (this.ensureTempDirPromise !== null) {
      return this.ensureTempDirPromise;
    }
    this.ensureTempDirPromise = fsp.mkdtemp(path.join(this.dir, `${process.pid}-${randomUUID()}`));
    return this.ensureTempDirPromise;
  }
}
