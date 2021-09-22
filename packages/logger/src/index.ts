import {defaultLoggerBuilder, SenseLoggerBuilder} from './logger-builder.js';
import {createModule, LoggerBuilder} from '@sensejs/core';

export * from './definition.js';
export {BasicTextLogTransformer} from './basic-text-log-transformer.js';
export {ColorTtyTextLogTransformer} from './color-tty-text-log-transformer.js';
export {PlainTextLogTransformer} from './plain-text-log-transformer.js';
export {StreamLogTransport} from './stream-log-transport.js';
export {SenseLoggerBuilder, defaultLoggerBuilder} from './logger-builder.js';

export const SenseLogModule = createModule({
  constants: [
    {provide: LoggerBuilder, value: defaultLoggerBuilder},
    {provide: SenseLoggerBuilder, value: defaultLoggerBuilder},
  ],
});
