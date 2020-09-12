/* tslint:disable no-console */

export interface Logger {
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

declare const console: Logger;

export class SilentLogger implements Logger {
  debug() {}

  error() {}

  fatal() {}

  info() {}

  log() {}

  trace() {}

  warn() {}
}

class ConsoleLogger implements Logger {
  debug(...content: [unknown, ...unknown[]]): void {
    console.debug(...content);
  }

  error(...content: [unknown, ...unknown[]]): void {
    console.error(...content);
  }

  fatal(...content: [unknown, ...unknown[]]): void {
    console.error(...content);
  }

  info(...content: [unknown, ...unknown[]]): void {
    console.info(...content);
  }

  log(...content: [unknown, ...unknown[]]): void {
    console.log(...content);
  }

  trace(...content: [unknown, ...unknown[]]): void {
    console.trace(...content);
  }

  warn(...content: [unknown, ...unknown[]]): void {
    console.warn(...content);
  }
}

export const consoleLogger = new ConsoleLogger();
