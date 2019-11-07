import {LogLevel, LogTransformer, LogTransport, RawLogData} from './definition';
import {ColorTtyTextLogTransformer} from './color-tty-text-log-transformer';
import {PlainTextLogTransformer} from './plain-text-log-transformer';
import {Transform} from 'stream';

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
  private _lastWriteFlushed = Promise.resolve();
  private _streamWritable: boolean = true;
  private _bufferedLogContent: (() => boolean)[] = [];

  constructor(
    private _writeStream: NodeJS.WritableStream,
    private _levels: LogLevel[],
    private _transformer = defaultLogFormatter(_writeStream),
  ) {
    this._writeStream.on('drain', () => {
      while (this._bufferedLogContent.length > 0) {
        const fn = this._bufferedLogContent.shift();
        if (!fn!()) {
          return;
        }
      }
      this._streamWritable = true;
    });
  }

  write(content: RawLogData) {
    if (this._levels.indexOf(content.level) < 0) {
      return Promise.resolve();
    }
    const formattedContent = this._transformer.format(content);
    if (!this._streamWritable) {
      this._lastWriteFlushed = new Promise((resolve, reject) => {
        this._bufferedLogContent.push(() => {
          return this._writeStream.write(formattedContent, (e) => {
            if (e) {
              return reject(e);
            }
            return resolve();
          });
        });
      });
    } else {
      this._lastWriteFlushed = new Promise((resolve, reject) => {
        this._streamWritable = this._writeStream.write(formattedContent, (error) => {
          if (error) {
            return reject(error);
          }
          return resolve();
        });
      });
    }
    return this._lastWriteFlushed;
  }

  flush(): Promise<void> {
    return this._lastWriteFlushed;
  }
}
