import {defaultLoggerBuilder} from './logger-builder';
import {LOGGER_BUILDER_SYMBOL, LoggerModule, Module} from '@sensejs/core';

export * from './definition';
export {BasicTextLogTransformer} from './basic-text-log-transformer';
export {ColorTtyTextLogTransformer} from './color-tty-text-log-transformer';
export {PlainTextLogTransformer} from './plain-text-log-transformer';
export {StreamLogTransport} from './stream-log-transport';
export {SenseLoggerBuilder, defaultLoggerBuilder} from './logger-builder';

export const SenseLogModule = Module({
  requires: [LoggerModule],
  constants: [{provide: LOGGER_BUILDER_SYMBOL, value: defaultLoggerBuilder}],
});
