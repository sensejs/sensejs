import {defaultLoggerBuilder, SenseLoggerBuilder} from './logger-builder';
import {createModule, LoggerBuilder} from '@sensejs/core';

export * from './definition';
export {BasicTextLogTransformer} from './basic-text-log-transformer';
export {ColorTtyTextLogTransformer} from './color-tty-text-log-transformer';
export {PlainTextLogTransformer} from './plain-text-log-transformer';
export {StreamLogTransport} from './stream-log-transport';
export {SenseLoggerBuilder, defaultLoggerBuilder} from './logger-builder';

export const SenseLogModule = createModule({
  constants: [{provide: LoggerBuilder, value: defaultLoggerBuilder},
  {provide: SenseLoggerBuilder, value: defaultLoggerBuilder}],
});
