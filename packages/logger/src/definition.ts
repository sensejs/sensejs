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
  module: string;
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

export interface Logger {
  /**
   * Get a new logger with different metadata
   * @param module {string|null} Specify a new label, or preserve the original label by passing null
   * @param [traceId] {string} Optional trace id
   */
  (module: string | null, traceId?: string): Logger;

  /**
   * Log message with severity of trace
   * @param content messages
   */
  trace(...content: [unknown, ...unknown[]]): void;

  /**
   * Log message with severity of debug
   * @param content messages
   */
  debug(...content: [unknown, ...unknown[]]): void;

  /**
   * alias of info
   * @param content messages
   */
  log(...content: [unknown, ...unknown[]]): void;

  /**
   * Log message with severity of info
   * @param content messages
   */
  info(...content: [unknown, ...unknown[]]): void;

  /**
   * Log message with severity of warning
   * @param content messages
   */
  warn(...content: [unknown, ...unknown[]]): void;

  /**
   * Log message with severity of error
   * @param content messages
   */
  error(...content: [unknown, ...unknown[]]): void;

  /**
   * Log message with severity of error
   * @param content messages
   */
  fatal(...content: [unknown, ...unknown[]]): void;
}
