import '@sensejs/testing-utility/lib/mock-console';
import {consoleLogger as logger} from '../src';

test('ConsoleLogger', () => {
  logger.fatal('fatal');
  logger.error('error');
  logger.warn('warn');
  logger.info('info');
  logger.log('log');
  logger.debug('debug');
  logger.trace('debug');
});
