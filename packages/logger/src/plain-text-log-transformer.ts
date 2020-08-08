import {BasicTextLogTransformer, MetadataView} from './basic-text-log-transformer';
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
const plainTextView = (text: string) => {
  return {text, length: text.length};
};

function plainLevel(metadata: RawLogData) {
  return plainTextView(LOG_LEVEL_TAG[metadata.level]);
}

function plainIsoTimestamp(metadata: RawLogData) {
  return plainTextView(new Date(metadata.timestamp).toISOString());
}

function plainLogLabel(metadata: RawLogData) {
  return plainTextView(metadata.label ? `<${metadata.label}>` : '-');
}

function plainTraceId(metadata: RawLogData) {
  return metadata.traceId ? plainTextView(`{${metadata.traceId}}`) : plainTextView('-');
}

export class PlainTextLogTransformer extends BasicTextLogTransformer {
  getMetadataView(): MetadataView[] {
    return [plainIsoTimestamp, plainLevel, plainLogLabel, plainTraceId];
  }

  contentFormatter(...messages: [unknown, ...unknown[]]): string {
    return format(...messages);
  }
}
