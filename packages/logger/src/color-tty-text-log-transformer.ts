import colors from 'colors/safe';
import moment from 'moment';
import {BasicTextLogTransformer} from './basic-text-log-transformer';
import {LogLevel, RawLogData} from './definition';
import {format, formatWithOptions} from 'util';

// @ts-ignore
const optionFormat = (...args: [unknown, ...unknown[]]) => formatWithOptions({colors: true}, ...args);
const availableFormat = formatWithOptions ? optionFormat : format;

function logLevelColorMap(level: LogLevel) {
  switch (level) {
    case LogLevel.TRACE:
      return colors.blue;
    case LogLevel.DEBUG:
      return colors.cyan;
    case LogLevel.INFO:
      return colors.green;
    case LogLevel.WARN:
      return colors.yellow;
    case LogLevel.ERROR:
      return colors.magenta;
    case LogLevel.FATAL:
      return colors.red;
  }
}

function colorTextView(color: (input: string) => string, text: string) {
  return {
    text: color(text),
    length: text.length,
  };
}

function timestampColoredBySeverity(metadata: RawLogData) {
  return colorTextView(logLevelColorMap(metadata.level), moment(metadata.timestamp).format(moment.HTML5_FMT.TIME_MS));
}

function boldModuleName(metadata: RawLogData) {
  return metadata.module ? colorTextView(colors.bold, metadata.module) : colorTextView(colors.grey, '-');
}

function underlinedTraceId(metadata: RawLogData) {
  return metadata.traceId ? colorTextView(colors.underline, metadata.traceId) : colorTextView(colors.grey, '-');
}

export class ColorTtyTextLogTransformer extends BasicTextLogTransformer {
  getMetadataView() {
    return [timestampColoredBySeverity, boldModuleName, underlinedTraceId];
  }

  getEventMark(rawData: RawLogData): string {
    return logLevelColorMap(rawData.level)(super.getEventMark(rawData));
  }

  getContentSeparator(rawData: RawLogData): string {
    return colors.grey(super.getContentSeparator(rawData));
  }

  contentFormatter(...messages: [unknown, ...unknown[]]) {
    return availableFormat(...messages);
  }
}
