import {Readable, Writable} from 'stream';
import {MultipartFileEntry, MultipartFileInfo} from './types.js';
import assert from 'assert';
import {RemoteStorageAdaptor} from './remote-storage-adaptor.js';

export class UploadStream<F extends {}, P extends {}> extends Writable {
  /*
   * buffer layout:
   *
   *
   * When buffer is empty, tailIdx = headIdx, and should be normalized to
   * headIdx = 0
   *
   *     0                                                         length
   *     ----------------------------------------------------------------
   *     ^
   *     |
   *     head = tail = 0
   *
   * When there is x bytes in the buffer and the tail index is not yet wrapped,
   * tailIdx = headIdx + x + 1
   *
   *     0                                       x                 length
   *     ========================================------------------------
   *     ^                                       ^
   *     |                                       |
   *     head                                    tail = x+1
   *
   * When there is z bytes in the buffer and tail index is wrapped so that
   * the content split into two parts, where the one from headIdx to the end
   * has x bytes, and the one from the beginning to tailIdx has y bytes,
   * satisfying that z = x + y, in such situation, headIdx = tail - x, and
   * tailIdx = y - 1 (IMPORTANT! it need to minus 1 to distinguish an empty
   * buffer from a full buffer).
   *
   *     0                    y            x                        length
   *     ======================------------==============================
   *                          ^            ^
   *                          |            |
   *                          tail = x     head
   *
   *
   * When the buffer is full:
   * either the headIdx is 0 and the tailIdx is equal to the length, when
   * data written from the beginning of the buffer to the end of the buffer
   *
   *     0                                                         length
   *     ================================================================
   *     ^                                                               ^
   *     |                                                               |
   *     head                                                 tail = length
   *
   * or headIdx is equal to tailIdx-1 when headIdx is not 0, for the case that
   * data is written from headIdx to the end of buffer and then from the
   * beginning of the buffer to tailIdx
   *
   *     0                                                         length
   *     ================================================================
   *                ^^
   *                ||
   *                |tail
   *                head
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
      this.reject(error);
    }
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  _final(callback: (error?: Error | null) => void) {
    if (this.initMultipartUploadPromise) {
      // We've started a partitioned upload, wait for it to finish

      const initMultipartUploadPromise = this.initMultipartUploadPromise;
      this.promiseQueue = this.promiseQueue
        .then(async () => {
          assert(this.uploadIdx == this.headIdx);
          const p = await initMultipartUploadPromise;
          if (this.headIdx < this.tailIdx) {
            const remaining = this.tailIdx - this.headIdx;
            assert(remaining < this.adaptor.maxPartitionedUploadSize);
            const readable = Readable.from(this.buffer.slice(this.headIdx, this.tailIdx));
            await this.adaptor.uploadPartition(p, readable, this.tailIdx - this.headIdx);
          } else if (this.headIdx > this.tailIdx) {
            const remaining = this.buffer.length - this.headIdx + this.tailIdx + 1;
            assert(remaining < this.adaptor.maxPartitionedUploadSize);
            const readable = Readable.from([this.buffer.slice(this.headIdx), this.buffer.slice(0, this.tailIdx + 1)]);
            await this.adaptor.uploadPartition(p, readable, this.tailIdx - this.headIdx);
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

  private partitionedUpload(pud: Promise<P>, chunk: Buffer, callback: (error?: Error | null) => void) {
    if (this.headIdx <= this.tailIdx) {
      if (this.tailIdx !== this.buffer.length) {
        // The tailIdx is not yet wrapped around
        const chunkLength = Math.min(this.buffer.length - this.tailIdx, chunk.length);
        chunk.copy(this.buffer, this.tailIdx, 0, chunkLength);
        chunk = chunk.slice(chunkLength);
        this.tailIdx += chunkLength;
      }
      if (chunk.length > 0 && this.headIdx > 0) {
        const chunkLength = Math.min(this.headIdx, chunk.length);
        chunk.copy(this.buffer, 0, 0, chunkLength);
        chunk = chunk.slice(chunkLength);
        this.tailIdx = chunkLength - 1;
      }
    } else if (this.headIdx > this.tailIdx + 1) {
      // The tailIdx is wrapped around
      const chunkLength = Math.min(this.headIdx - this.tailIdx - 1, chunk.length);
      chunk.copy(this.buffer, this.tailIdx + 1, 0, chunkLength);
      chunk = chunk.slice(chunkLength);
      this.tailIdx += chunkLength;
    } else if ((this.headIdx === 0 && this.tailIdx === this.buffer.length) || this.tailIdx + 1 === this.headIdx) {
      // The buffer is full, wait for the upload to finish and try again
      // Just return directly, no need to schedule upload partitions as nothing has been written into the buffer
      // for this try
      return this.sink(chunk, callback, pud);
    }

    // The data has been written into the buffer, check the uploadIdx to see if we can upload the data
    if (this.headIdx <= this.tailIdx) {
      for (;;) {
        assert(this.uploadIdx <= this.tailIdx);
        assert(this.headIdx <= this.uploadIdx);
        const pendingSize = this.tailIdx - this.uploadIdx;
        if (pendingSize < this.adaptor.maxPartitionedUploadSize) {
          break;
        }
        // There's enough data to upload
        const data = this.buffer.slice(this.uploadIdx, this.uploadIdx + this.adaptor.maxPartitionedUploadSize);
        const currentUploadIdx = (this.uploadIdx += this.adaptor.maxPartitionedUploadSize);
        this.promiseQueue = this.promiseQueue.then(() => {
          return pud.then((p) => {
            return this.adaptor.uploadPartition(p, Readable.from([data]), this.adaptor.maxPartitionedUploadSize).then(
              () => {
                if (currentUploadIdx === this.tailIdx) {
                  this.uploadIdx = this.headIdx = this.tailIdx = 0;
                } else {
                  this.uploadIdx = this.headIdx = currentUploadIdx === this.buffer.length ? 0 : currentUploadIdx;
                }
              },
              (e) => this.destroy(e),
            );
          });
        });
      }
    } else {
      for (;;) {
        assert(this.tailIdx <= this.uploadIdx || this.uploadIdx <= this.headIdx);
        if (this.uploadIdx >= this.headIdx) {
          let pendingSize = this.buffer.length - this.uploadIdx;
          if (pendingSize >= this.adaptor.maxPartitionedUploadSize) {
            // There's enough data to upload
            const readable = Readable.from([
              this.buffer.slice(this.uploadIdx, this.uploadIdx + this.adaptor.maxPartitionedUploadSize),
            ]);
            const currentUploadIdx = (this.uploadIdx += this.adaptor.maxPartitionedUploadSize);
            this.promiseQueue = this.promiseQueue.then(() => {
              return pud.then((p) => {
                return this.adaptor.uploadPartition(p, readable, this.adaptor.maxPartitionedUploadSize).then(
                  () => {
                    if (currentUploadIdx === this.tailIdx) {
                      this.uploadIdx = this.headIdx = this.tailIdx = 0;
                    } else {
                      if (this.uploadIdx === this.buffer.length) {
                        this.uploadIdx = this.headIdx = 0;
                        this.tailIdx += 1;
                      } else {
                        this.uploadIdx = this.headIdx = currentUploadIdx;
                      }
                    }
                  },
                  (e) => this.destroy(e),
                );
              });
            });
            continue;
          }
          pendingSize += this.tailIdx + 1;

          if (pendingSize >= this.adaptor.maxPartitionedUploadSize) {
            const tailBuffer = this.buffer.slice(this.uploadIdx);
            const currentUploadIdx = (this.uploadIdx = this.adaptor.maxPartitionedUploadSize - tailBuffer.length);
            const headBuffer = this.buffer.slice(0, currentUploadIdx);

            // There's enough data to upload
            const readable = Readable.from([tailBuffer, headBuffer]);
            this.promiseQueue = this.promiseQueue.then(() => {
              return pud.then((p) => {
                return this.adaptor.uploadPartition(p, readable, this.adaptor.maxPartitionedUploadSize).then(
                  () => {
                    if (currentUploadIdx === this.tailIdx) {
                      this.uploadIdx = this.headIdx = this.tailIdx = 0;
                    } else {
                      this.uploadIdx = this.headIdx = currentUploadIdx; // === this.buffer.length ? 0 : currentUploadIdx;
                      // Important: the buffer is become continuous again, so we need to adjust the tailIdx
                      this.tailIdx += 1;
                    }
                  },
                  (e) => this.destroy(e),
                );
              });
            });
            continue;
          }
          break;
        } else {
          const pendingSize = this.tailIdx - this.uploadIdx;
          if (pendingSize < this.adaptor.maxPartitionedUploadSize) {
            break;
          }
          // There's enough data to upload
          const readable = Readable.from([
            this.buffer.slice(this.uploadIdx, this.uploadIdx + this.adaptor.maxPartitionedUploadSize),
          ]);
          const currentUploadIdx = (this.uploadIdx += this.adaptor.maxPartitionedUploadSize);
          this.promiseQueue = this.promiseQueue.then(() => {
            return pud.then((p) => {
              return this.adaptor.uploadPartition(p, readable, this.adaptor.maxPartitionedUploadSize).then(
                () => {
                  if (currentUploadIdx === this.tailIdx) {
                    this.uploadIdx = this.headIdx = this.tailIdx = 0;
                  } else {
                    this.uploadIdx = this.headIdx = currentUploadIdx === this.buffer.length ? 0 : currentUploadIdx;
                  }
                },
                (e) => this.destroy(e),
              );
            });
          });
        }
      }
    }
    this.sink(chunk, callback, pud);
  }

  private sink(chunk: Buffer, callback: (error?: Error | null) => void, pud: Promise<P>) {
    if (chunk.length === 0) {
      setImmediate(callback);
    } else {
      this.promiseQueue = this.promiseQueue.then(() => {
        this.partitionedUpload(pud, chunk, callback);
      }, callback);
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
    this.initMultipartUploadPromise = this.promiseQueue.then(() =>
      this.adaptor.beginPartitionedUpload(this.name, this.info),
    );
    return this.initMultipartUploadPromise;
  }
}
