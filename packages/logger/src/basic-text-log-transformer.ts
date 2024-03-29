import {LogTransformer, RawLogData} from './definition.js';

export type MetadataView = (metadata: RawLogData) => {text: string; length: number};

export abstract class BasicTextLogTransformer implements LogTransformer {
  abstract contentFormatter(...messages: [unknown, ...unknown[]]): string;

  abstract getMetadataView(): MetadataView[];

  getEventMark(rawData: RawLogData): string {
    return '+';
  }

  getContentSeparator(rawData: RawLogData): string {
    return '|';
  }

  getMetadataSeparator(rawData: RawLogData): string {
    return ' ';
  }

  format(rawData: RawLogData): Buffer {
    const metadataInfo = this.getMetadataView()
      .map((fn) => fn(rawData))
      .reduce(
        (obj, view) => {
          obj.span.push(view.text);
          obj.length += view.length;
          return obj;
        },
        {span: [] as string[], length: 0},
      );
    const formattedContent = this.contentFormatter(...rawData.messages).replace(/\n*$/, '');
    return Buffer.from(
      formattedContent
        .split('\n')
        .map((line, idx) => {
          return [idx === 0 ? this.getEventMark(rawData) : this.getMetadataSeparator(rawData)]
            .concat(metadataInfo.span)
            .concat(this.getContentSeparator(rawData))
            .concat(line)
            .join(this.getMetadataSeparator(rawData));
        })
        .concat('')
        .join('\n'),
    );
  }
}
