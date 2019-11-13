import {BasicTextLogTransformer} from './basic-text-log-transformer';
import {LogLevel, RawLogData} from './definition';
import {format} from 'util';

export const LOG_LEVEL_TAG = {
  [LogLevel.TRACE]: 'trace',
  [LogLevel.ERROR]: 'error',
  [LogLevel.WARN]: ' warn',
  [LogLevel.INFO]: ' info',
  [LogLevel.DEBUG]: 'debug',
  [LogLevel.FATAL]: 'fatal',
};
const plainTextView = (text: string) => ({text, length: text.length});

function plainLevel(metadata: RawLogData) {
  return plainTextView(LOG_LEVEL_TAG[metadata.level]);
}

function plainIsoTimestamp(metadata: RawLogData) {
  return plainTextView(new Date(metadata.timestamp).toISOString());
}

function plainModuleName(metadata: RawLogData) {
  return plainTextView(metadata.module ? `<${metadata.module}>` : '-');
}

function plainTraceId(metadata: RawLogData) {
  return metadata.traceId ? plainTextView(`{${metadata.traceId}}`) : plainTextView('-');
}

export class PlainTextLogTransformer extends BasicTextLogTransformer {
  getMetadataView() {
    return [plainIsoTimestamp, plainLevel, plainModuleName, plainTraceId];
  }

  contentFormatter(...messages: [unknown, ...unknown[]]) {
    return format(...messages);
  }
}
