import {LogLevel, LogTransport, RawLogData} from './definition';
import {ColorTtyTextLogTransformer} from './color-tty-text-log-transformer';
import {PlainTextLogTransformer} from './plain-text-log-transformer';

function checkIsTty(writableStream: NodeJS.WritableStream): boolean{
    let ws = writableStream as NodeJS.WriteStream;
    return ws.isTTY === true;
}

function defaultLogFormatter(writeStream: NodeJS.WritableStream) {
    if (checkIsTty(writeStream)) {
        return new ColorTtyTextLogTransformer();
    } else {
        return new PlainTextLogTransformer();
    }
}

export class StreamLogTransport implements LogTransport {
    private _lastWriteFlushed = Promise.resolve();

    constructor(private _writeStream: NodeJS.WritableStream,
                private _levels: LogLevel[],
                private _transformer = defaultLogFormatter(_writeStream)) {
    }

    write(content: RawLogData) {
        if (this._levels.indexOf(content.level) < 0) {
            return Promise.resolve();
        }
        const formattedContent = this._transformer.format(content);
        this._lastWriteFlushed = new Promise((resolve, reject) => {
            return this._writeStream.write(formattedContent, (error) => {
                if (error) {
                    return reject(error);
                }
                return resolve();
            });
        });
        return this._lastWriteFlushed;
    }

    flush(): Promise<void> {
        return this._lastWriteFlushed;
    }


}
