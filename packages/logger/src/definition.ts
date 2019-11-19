export enum LogLevel {
  FATAL,
  ERROR,
  WARN,
  INFO,
  DEBUG,
  TRACE,
}

export interface RawLogData {
  timestamp: number;
  level: LogLevel;
  label: string;
  traceId?: string;
  messages: [unknown, ...unknown[]];
}

export interface LogTransformer {
  contentFormatter(content: string): string;

  format(metadata: RawLogData): Buffer;
}

export interface LogTransport {
  write(rawLogData: RawLogData): Promise<any>;

  flush(): Promise<void>;
}
