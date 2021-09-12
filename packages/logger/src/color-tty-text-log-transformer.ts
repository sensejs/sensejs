import chalk from 'chalk';
import moment from 'moment';
import {BasicTextLogTransformer, MetadataView} from './basic-text-log-transformer';
import {LogLevel, RawLogData} from './definition';
import {formatWithOptions} from 'util';

function logLevelColorMap(level: LogLevel) {
  switch (level) {
    case LogLevel.TRACE:
      return chalk.blue;
    case LogLevel.DEBUG:
      return chalk.cyan;
    case LogLevel.INFO:
      return chalk.green;
    case LogLevel.WARN:
      return chalk.yellow;
    case LogLevel.ERROR:
      return chalk.red;
    case LogLevel.FATAL:
      return chalk.redBright;
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

function boldLogLabel(metadata: RawLogData) {
  return metadata.label ? colorTextView(chalk.bold.bold, metadata.label) : colorTextView(chalk.grey, '-');
}

function underlinedTraceId(metadata: RawLogData) {
  return metadata.traceId ? colorTextView(chalk.underline, metadata.traceId) : colorTextView(chalk.grey, '-');
}

export class ColorTtyTextLogTransformer extends BasicTextLogTransformer {
  getMetadataView(): MetadataView[] {
    return [timestampColoredBySeverity, boldLogLabel, underlinedTraceId];
  }

  getEventMark(rawData: RawLogData): string {
    return logLevelColorMap(rawData.level)(super.getEventMark(rawData));
  }

  getContentSeparator(rawData: RawLogData): string {
    return chalk.grey(super.getContentSeparator(rawData));
  }

  contentFormatter(...messages: [unknown, ...unknown[]]): string {
    // @ts-ignore
    return formatWithOptions({colors: true}, ...messages);
  }
}
