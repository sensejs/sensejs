import {LogLevel, LogTransformer, LogTransport, RawLogData} from './definition.js';
import {ColorTtyTextLogTransformer} from './color-tty-text-log-transformer.js';
import {PlainTextLogTransformer} from './plain-text-log-transformer.js';

function checkIsTty(writableStream: NodeJS.WritableStream): boolean {
  const ws = writableStream as NodeJS.WriteStream;
  return ws.isTTY === true;
}

function defaultLogFormatter(writeStream: NodeJS.WritableStream): LogTransformer {
  if (checkIsTty(writeStream)) {
    return new ColorTtyTextLogTransformer();
  } else {
    return new PlainTextLogTransformer();
  }
}

export class StreamLogTransport implements LogTransport {
  #whenLastWriteFlushed = Promise.resolve();
  #whenStreamDrained = Promise.resolve();
  #streamWritable: boolean = true;
  readonly #writeStream: NodeJS.WritableStream;
  readonly #levels: LogLevel[];
  readonly #transformer; // = defaultLogFormatter(_writeStream);

  constructor(writeStream: NodeJS.WritableStream, levels: LogLevel[], transformer = defaultLogFormatter(writeStream)) {
    this.#writeStream = writeStream;
    this.#levels = levels;
    this.#transformer = transformer;
  }

  async write(content: RawLogData): Promise<void> {
    if (this.#levels.indexOf(content.level) < 0) {
      return Promise.resolve();
    }
    const formattedContent = this.#transformer.format(content);
    while (!this.#streamWritable) {
      await this.#whenStreamDrained;
    }
    this.#whenLastWriteFlushed = this.#flushLogDirectly(formattedContent);
    return this.#whenLastWriteFlushed;
  }

  async flush(): Promise<void> {
    while (!this.#streamWritable) {
      await this.#whenStreamDrained;
      await this.#whenLastWriteFlushed;
    }
    return this.#whenLastWriteFlushed;
  }

  #flushLogDirectly(buffer: Buffer) {
    return new Promise<void>((resolve, reject) => {
      this.#streamWritable = this.#writeStream.write(buffer, (e) => {
        if (e) {
          return reject(e);
        }
        return resolve();
      });
      if (!this.#streamWritable) {
        this.#checkStreamWritable();
      }
    });
  }

  #checkStreamWritable() {
    this.#whenStreamDrained = new Promise((resolve) =>
      this.#writeStream.once('drain', () => {
        this.#streamWritable = true;
        resolve();
      }),
    );
  }
}
