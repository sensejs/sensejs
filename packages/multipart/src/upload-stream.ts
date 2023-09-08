import {Readable, Writable} from 'stream';
import {MultipartFileEntry, MultipartFileInfo} from './types.js';
import {ChecksumCalculator, RemoteStorageAdaptor} from './remote-storage-adaptor.js';
import {MultipartLimitExceededError} from './error.js';

/*
 * This class wraps a remote storage adaptor and provides a writable stream for
 * handling multipart upload.

 *
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
export class UploadStream<F extends {}, P extends {}, C extends ChecksumCalculator<unknown>> extends Writable {
  readonly #buffer: Buffer;
  #headIdx = 0;
  #tailIdx = 0;
  #uploadIdx = 0;
  #fileSize = 0;
  #promiseQueue: Promise<any> = Promise.resolve();
  #initMultipartUploadPromise: Promise<P> | null = null;
  readonly #adaptor: RemoteStorageAdaptor<F, P, C>;

  constructor(
    adaptor: RemoteStorageAdaptor<F, P, C>,
    private name: string,
    private info: MultipartFileInfo,
    private resolve: (file: MultipartFileEntry) => void,
  ) {
    super();
    this.#adaptor = adaptor;
    this.#buffer = Buffer.allocUnsafe(
      Math.max(
        this.#adaptor.bufferSizeLimit,
        Math.max(adaptor.simpleUploadSizeLimit, adaptor.partitionedUploadSizeLimit),
      ),
    );
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  override _write(chunk: Buffer, encoding: string, callback: (error?: Error | null) => void): void {
    if (this.#fileSize + chunk.length > this.#adaptor.fileSizeLimit) {
      return callback(new MultipartLimitExceededError('file size limit exceeded'));
    }
    this.#fileSize += chunk.length;
    let pudPromise: Promise<P> | null = null;

    if (
      this.#fileSize > this.#adaptor.simpleUploadSizeLimit &&
      this.#fileSize > this.#adaptor.partitionedUploadSizeLimit
    ) {
      // If the file size already exceeds the limit of both simple upload and partitioned upload,
      // initiate a partitioned upload immediately
      pudPromise = this.#initMultipartUploadIfNecessary();
      this.#partitionedUpload(pudPromise, chunk, callback);
      return;
    }

    // If the file size is less than the limit of simple upload, just write the data into the buffer
    chunk.copy(this.#buffer, this.#tailIdx);
    this.#tailIdx += chunk.length;
    process.nextTick(callback);
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  override _destroy(error: Error | null, callback: (error?: Error | null) => void) {
    if (error) {
      // It needs to be emitted immediately, otherwise it could be overridden by a NodeError("Premature close")
      // when using in a pipeline, on Node.js prior to v18
      this.emit('error', error);
      if (this.#initMultipartUploadPromise) {
        this.#initMultipartUploadPromise
          .then((p) => this.#adaptor.abortPartitionedUpload(p))
          .then(() => {
            callback();
          }, callback);
        return;
      }
    }
    process.nextTick(callback);
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  override _final(callback: (error?: Error | null) => void) {
    if (this.#initMultipartUploadPromise) {
      // We've started a partitioned upload, wait for it to finish

      this.#uploadIfNecessary(this.#initMultipartUploadPromise);
      const initMultipartUploadPromise = this.#initMultipartUploadPromise;
      this.#promiseQueue = this.#promiseQueue
        .then(async () => {
          const p = await initMultipartUploadPromise;
          const remaining = this.#tailIdx - this.#headIdx;
          if (remaining > 0) {
            const checksumCalculator = this.#adaptor.createChecksumCalculator();
            const readable = this.#createStreamForPartitionedUpload(remaining, checksumCalculator);
            await this.#adaptor.uploadPartition(p, readable, remaining, checksumCalculator);
          }
          const result = await this.#adaptor.finishPartitionedUpload(p);
          this.resolve({
            type: 'file',
            name: this.name,
            size: this.#fileSize,
            body: () => this.#adaptor.createReadStream(result),
            mimeType: this.info.mimeType,
            filename: this.info.filename,
            transferEncoding: this.info.transferEncoding,
          });
          return;
        })
        .then(() => {
          callback();
        }, callback);
    } else {
      // We haven't started a partitioned upload, upload the content in the buffer using simple upload
      this.#adaptor.upload(this.name, this.#buffer.slice(0, this.#tailIdx), this.info).then((result) => {
        this.resolve({
          name: this.name,
          size: this.#fileSize,
          body: () => this.#adaptor.createReadStream(result),
          mimeType: this.info.mimeType,
          filename: this.info.filename,
          transferEncoding: this.info.transferEncoding,
          type: 'file',
        });
        callback();
      }, callback);
    }
  }

  /**
   * Create a stream for partitioned upload
   * @param size The size of the stream
   * @param checksumCalculator The checksum calculator to which the data of the whole partition will be filled in for
   * calculating checksum
   * @private
   */
  #createStreamForPartitionedUpload(size: number, checksumCalculator: C): Readable {
    let currentUploadIdx = this.#uploadIdx;
    const chunkIndexes: [number, number][] = [];
    const end = this.#uploadIdx + size;
    if (currentUploadIdx < this.#buffer.length) {
      const nextUploadIdx = Math.min(end, this.#buffer.length);
      const slice = this.#buffer.slice(currentUploadIdx, nextUploadIdx);
      if (checksumCalculator !== null) {
        checksumCalculator.update(slice);
      }
      chunkIndexes.push([currentUploadIdx, nextUploadIdx]);
      currentUploadIdx = nextUploadIdx;
    }

    if (currentUploadIdx >= this.#buffer.length && currentUploadIdx < end) {
      const slice = this.#buffer.slice(currentUploadIdx - this.#buffer.length, end - this.#buffer.length);
      if (checksumCalculator !== null) {
        checksumCalculator.update(slice);
      }
      chunkIndexes.push([currentUploadIdx, end]);
      currentUploadIdx = end;
    }
    this.#uploadIdx = currentUploadIdx;
    return this.#createReadableFromChunkIndexes(chunkIndexes);
  }

  /**
   * Create a readable stream from chunk indexes
   * @param chunkIndexes
   * @private
   */
  #createReadableFromChunkIndexes(chunkIndexes: [number, number][]) {
    return Readable.from(
      async function* (this: UploadStream<F, P, C>) {
        for (const [start, end] of chunkIndexes) {
          if (end < this.#buffer.length) {
            yield this.#buffer.slice(start, end);
            this.#headIdx = end;
          } else if (end > this.#buffer.length) {
            yield this.#buffer.slice(start - this.#buffer.length, end - this.#buffer.length);
            this.#headIdx = end - this.#buffer.length;
          } else if (end === this.#buffer.length) {
            yield this.#buffer.slice(start);
            this.#headIdx = 0;
            this.#tailIdx -= this.#buffer.length;
            this.#uploadIdx -= this.#buffer.length;
          }
        }
      }.apply(this),
    );
  }

  /**
   * Buffer the data in memory, and upload them using partitioned upload when necessary
   *
   * @param pudPromise A promise that resolves to a partitioned upload descriptor
   * @param chunk The incoming data need to be buffered or uploaded
   * @param callback The callback function
   * @private
   */
  #partitionedUpload(pudPromise: Promise<P>, chunk: Buffer, callback: (error?: Error | null) => void) {
    // The overall strategy is to first fill the buffer, when the size of buffered content exceeds the limit of
    // a partitioned upload, perform a partitioned upload, then continue to fill the buffer.
    // While creating the stream immediately and fill the stream when new chunk comes is more efficient, it's not always
    // possible because some remote storage services requires the size of each partition to be known in advance.

    // console.log('filling buffer', this.tailIdx, this.headIdx);
    if (chunk.length > 0 && this.#tailIdx - this.#headIdx < this.#buffer.length) {
      // First try to fill the buffer to the end
      if (this.#tailIdx < this.#buffer.length) {
        const chunkLength = Math.min(this.#buffer.length - this.#tailIdx, chunk.length);
        chunk.copy(this.#buffer, this.#tailIdx, 0, chunkLength);
        chunk = chunk.slice(chunkLength);
        this.#tailIdx += chunkLength;
      }

      // Then try to fill the buffer from the beginning
      if (chunk.length > 0 && this.#tailIdx - this.#headIdx < this.#buffer.length) {
        const chunkLength = Math.min(
          // // the space available in the buffer
          this.#buffer.length - this.#tailIdx + this.#headIdx,
          // we must ensure that the headIdx is never greater than length of the buffer
          2 * this.#buffer.length - this.#tailIdx,
          chunk.length,
        );
        chunk.copy(this.#buffer, this.#tailIdx - this.#buffer.length, 0, chunkLength);
        chunk = chunk.slice(chunkLength);
        this.#tailIdx += chunkLength;
      }
    }

    this.#uploadIfNecessary(pudPromise);

    this.#promiseQueue = this.#promiseQueue.then(() => {
      if (chunk.length === 0) {
        callback();
      } else {
        // console.log('chunk.length', chunk.length);
        this.#partitionedUpload(pudPromise, chunk, callback);
      }
    }, callback);
  }

  /**
   * Upload the content in the buffer via partitioned upload if necessary
   *
   * @param pudPromise A promise that resolves to a partitioned upload descriptor
   * @private
   */
  #uploadIfNecessary(pudPromise: Promise<P>) {
    while (this.#tailIdx - this.#uploadIdx >= this.#adaptor.partitionedUploadSizeLimit) {
      const checksumCalculator = this.#adaptor.createChecksumCalculator();
      const readable = this.#createStreamForPartitionedUpload(
        this.#adaptor.partitionedUploadSizeLimit,
        checksumCalculator,
      );
      this.#promiseQueue = this.#promiseQueue
        .then(() => pudPromise)
        .then((p) => {
          return this.#adaptor.uploadPartition(
            p,
            readable,
            this.#adaptor.partitionedUploadSizeLimit,
            checksumCalculator,
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
  #initMultipartUploadIfNecessary(): Promise<P> {
    if (this.#initMultipartUploadPromise) {
      return this.#initMultipartUploadPromise;
    }
    this.#initMultipartUploadPromise = this.#promiseQueue.then(() =>
      this.#adaptor.beginPartitionedUpload(this.name, this.info),
    );
    return this.#initMultipartUploadPromise;
  }
}
