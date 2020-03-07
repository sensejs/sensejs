import {LogLevel, LogTransformer, LogTransport, RawLogData} from './definition';
import {ColorTtyTextLogTransformer} from './color-tty-text-log-transformer';
import {PlainTextLogTransformer} from './plain-text-log-transformer';

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
  private _whenLastWriteFlushed = Promise.resolve();
  private _whenStreamDrained = Promise.resolve();
  private _streamWritable: boolean = true;

  constructor(
    private readonly _writeStream: NodeJS.WritableStream,
    private readonly _levels: LogLevel[],
    private readonly _transformer = defaultLogFormatter(_writeStream),
  ) {}

  async write(content: RawLogData) {
    if (this._levels.indexOf(content.level) < 0) {
      return Promise.resolve();
    }
    const formattedContent = this._transformer.format(content);
    while (!this._streamWritable) {
      await this._whenStreamDrained;
    }
    this._whenLastWriteFlushed = this.flushLogDirectly(formattedContent);
    return this._whenLastWriteFlushed;
  }

  async flush(): Promise<void> {
    while (!this._streamWritable) {
      await this._whenStreamDrained;
      await this._whenLastWriteFlushed;
    }
    return this._whenLastWriteFlushed;
  }

  private flushLogDirectly(buffer: Buffer) {
    return new Promise<void>((resolve, reject) => {
      this._streamWritable = this._writeStream.write(buffer, (e) => {
        if (e) {
          return reject(e);
        }
        return resolve();
      });
      if (!this._streamWritable) {
        this.checkStreamWritable();
      }
    });
  }

  private checkStreamWritable() {
    this._whenStreamDrained = new Promise((resolve) => this._writeStream.once('drain', () => {
      this._streamWritable = true;
      resolve();
    }));
  }
}
