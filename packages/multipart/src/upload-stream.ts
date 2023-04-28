import {Readable, Writable} from 'stream';
import {MultipartFileEntry, MultipartFileInfo} from './types.js';
import assert from 'assert';
import {RemoteStorageAdaptor} from './remote-storage-adaptor.js';

export class UploadStream<F extends {}, P extends {}> extends Writable {
  /*
   * buffer layout:
   *
   *
   * When buffer is empty, tailIdx = headIdx
   *
   *     0                                                         length
   *     ----------------------------------------------------------------
   *     ^
   *     |
   *     head = tail = 0
   *
   * or
   *     0                   x                                     length
   *     ----------------------------------------------------------------
   *                         ^
   *                         |
   *                         head = tail = x
   *
   * When there is x bytes in the buffer and the tail index is not yet wrapped,
   * tailIdx = headIdx + x
   *
   *     0                                       x                 length
   *     ========================================------------------------
   *     ^                                       ^
   *     |                                       |
   *     head                                    tail = x
   *
   * or
   *
   *     0   t                                      x+t            length
   *     ----========================================--------------------
   *         ^                                      ^
   *         |                                      |
   *         head = t                               tail = x + t
   *
   * When there is z bytes in the buffer and tail index is wrapped so that
   * the content split into two parts, where the one from headIdx to the end
   * has x bytes, and the one from the beginning to tailIdx has y bytes,
   * satisfying that z = x + y, in such situation, headIdx = tail - x, and
   * tailIdx = y + length
   *
   *     0                    y                      x             length
   *     ======================----------------------====================
   *                          ^                      ^
   *                          |                      |
   *                          tail = y+length        head  = x
   *
   *
   * When the buffer is full, tail - head = length
   *
   *     0                                                         length
   *     ================================================================
   *     ^                                                              ^
   *     |                                                              |
   *     head                                                 tail = length
   *
   * or
   *
   *     0          x                                              length
   *     ================================================================
   *                ^
   *                |
   *                |tail = x + length
   *                |head = x
   *
   *
   */

  private readonly buffer: Buffer;
  private headIdx = 0;
  private tailIdx = 0;
  private uploadIdx = 0;
  private fileSize = 0;
  private promiseQueue: Promise<any> = Promise.resolve();
  private initMultipartUploadPromise: Promise<P> | null = null;

  constructor(
    private readonly adaptor: RemoteStorageAdaptor<F, P>,
    private name: string,
    private info: MultipartFileInfo,
    private resolve: (file: MultipartFileEntry<() => NodeJS.ReadableStream>) => void,
    private reject: (err?: any) => void,
  ) {
    super();
    this.buffer = Buffer.allocUnsafe(Math.max(adaptor.maxSimpleUploadSize, adaptor.maxPartitionedUploadSize));
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  _write(chunk: Buffer, encoding: string, callback: (error?: Error | null) => void): void {
    this.fileSize += chunk.length;
    let pudPromise: Promise<P> | null = null;

    if (this.fileSize > this.buffer.length) {
      // If the file size already exceeds the limit of both simple upload and partitioned upload,
      // initiate a partitioned upload immediately
      pudPromise = this.initMultipartUpload();
      this.partitionedUpload(pudPromise, chunk, callback);
      return;
    }

    // If the file size is less than the limit of simple upload, just write the data into the buffer
    chunk.copy(this.buffer, this.tailIdx);
    this.tailIdx += chunk.length;
    setImmediate(callback);
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  _destroy(error: Error | null, callback: (error?: Error | null) => void) {
    if (error) {
      if (this.initMultipartUploadPromise) {
        this.initMultipartUploadPromise.then((p) => this.adaptor.abortPartitionedUpload(p));
      }
      setImmediate(callback, error);
      // this.reject(error);
    }
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  _final(callback: (error?: Error | null) => void) {
    if (this.initMultipartUploadPromise) {
      // We've started a partitioned upload, wait for it to finish

      this.uploadIfNecessary(this.initMultipartUploadPromise);
      const initMultipartUploadPromise = this.initMultipartUploadPromise;
      this.promiseQueue = this.promiseQueue
        .then(async () => {
          const p = await initMultipartUploadPromise;
          const remaining = this.tailIdx - this.headIdx;
          if (remaining > 0) {
            if (this.tailIdx <= this.buffer.length) {
              const readable = Readable.from(this.buffer.slice(this.headIdx, this.tailIdx));
              await this.adaptor.uploadPartition(p, readable, remaining);
            } else {
              const readable = Readable.from([
                this.buffer.slice(this.headIdx),
                this.buffer.slice(0, this.tailIdx - this.buffer.length),
              ]);
              await this.adaptor.uploadPartition(p, readable, remaining);
            }
          }

          const result = await this.adaptor.finishPartitionedUpload(p);

          this.resolve({
            type: 'file',
            name: this.name,
            size: this.fileSize,
            content: () => this.adaptor.createReadStream(result),
            mimeType: this.info.mimeType,
            filename: this.info.filename,
            transferEncoding: this.info.transferEncoding,
          });

          // Otherwise, the buffer is empty, do nothing
        })
        .then(() => {
          callback();
        }, callback);
    } else {
      // We haven't started a partitioned upload, upload the content in the buffer using simple upload
      this.adaptor.upload(this.name, this.buffer.slice(0, this.tailIdx), this.info).then((result) => {
        this.resolve({
          name: this.name,
          size: this.fileSize,
          content: () => this.adaptor.createReadStream(result),
          mimeType: this.info.mimeType,
          filename: this.info.filename,
          transferEncoding: this.info.transferEncoding,
          type: 'file',
        });
        callback();
      }, callback);
    }
  }

  private partitionedUpload(pudPromise: Promise<P>, chunk: Buffer, callback: (error?: Error | null) => void) {
    // Check if it should perform a partitioned upload first
    this.uploadIfNecessary(pudPromise);
    if (chunk.length > 0 && this.tailIdx - this.headIdx < this.buffer.length) {
      // First try to fill the buffer to the end
      if (this.tailIdx < this.buffer.length) {
        const chunkLength = Math.min(this.buffer.length - this.tailIdx, chunk.length);
        chunk.copy(this.buffer, this.tailIdx, 0, chunkLength);
        chunk = chunk.slice(chunkLength);
        this.tailIdx += chunkLength;
      }

      // Then try to fill the buffer from the beginning
      if (chunk.length > 0 && this.tailIdx - this.headIdx < this.buffer.length) {
        const chunkLength = Math.min(
          // // the space available in the buffer
          this.buffer.length - this.tailIdx + this.headIdx,
          // we must ensure that the headIdx is never greater than length of the buffer
          2 * this.buffer.length - this.tailIdx,
          chunk.length,
        );
        chunk.copy(this.buffer, this.tailIdx - this.buffer.length, 0, chunkLength);
        chunk = chunk.slice(chunkLength);
        this.tailIdx += chunkLength;
      }
    }

    this.uploadIfNecessary(pudPromise);

    if (chunk.length === 0) {
      setImmediate(callback);
    } else {
      this.promiseQueue = this.promiseQueue.then(() => {
        this.partitionedUpload(pudPromise, chunk, callback);
      }, this.destroy.bind(this));
    }
  }

  private uploadIfNecessary(pudPromise: Promise<P>) {
    while (this.tailIdx - this.uploadIdx >= this.adaptor.maxPartitionedUploadSize) {
      const prevUploadIdx = this.uploadIdx;
      const currentUploadIdx = this.uploadIdx + this.adaptor.maxPartitionedUploadSize;
      const buffers: Buffer[] = [];
      if (this.uploadIdx > this.buffer.length) {
        buffers.push(this.buffer.slice(this.uploadIdx - this.buffer.length, currentUploadIdx - this.buffer.length));
      } else if (currentUploadIdx < this.buffer.length) {
        buffers.push(this.buffer.slice(this.uploadIdx, currentUploadIdx));
      } else {
        buffers.push(this.buffer.slice(this.uploadIdx));
        buffers.push(this.buffer.slice(0, currentUploadIdx - this.buffer.length));
      }
      const readable = Readable.from(buffers);

      this.uploadIdx = currentUploadIdx;
      this.promiseQueue = this.promiseQueue
        .then(() => pudPromise)
        .then((p) => {
          return this.adaptor.uploadPartition(p, readable, this.adaptor.maxPartitionedUploadSize).then(
            () => {
              // It's possible that the currentUploadIdx is greater than the buffer length, and we need to keep
              // headIdx < buffer.length
              this.headIdx =
                currentUploadIdx > this.buffer.length ? currentUploadIdx - this.buffer.length : currentUploadIdx;

              // When and only when the head index is just wrapped around, we can adjust them by minus the buffer length
              if (currentUploadIdx >= this.buffer.length && prevUploadIdx < this.buffer.length) {
                this.headIdx = currentUploadIdx - this.buffer.length;
                this.tailIdx -= this.buffer.length;
                this.uploadIdx -= this.buffer.length;
              }
            },
            (e) => {
              this.destroy(e);
              throw e;
            },
          );
        });
    }
  }

  /**
   * Initiate a partitioned upload, if not already initiated
   *
   * Multiple calls to this method will return the same promise
   * @private
   */
  private initMultipartUpload(): Promise<P> {
    if (this.initMultipartUploadPromise) {
      return this.initMultipartUploadPromise;
    }
    this.initMultipartUploadPromise = this.promiseQueue = this.promiseQueue.then(() =>
      this.adaptor.beginPartitionedUpload(this.name, this.info).catch((e) => {
        this.destroy(e);
      }),
    );
    return this.initMultipartUploadPromise;
  }
}
