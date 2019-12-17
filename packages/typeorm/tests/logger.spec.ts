import {createTypeOrmLogger} from '../src/logger';
import {Logger} from '@sensejs/core';

function mockLogger(): Logger {
  return {
    log: jest.fn(),
    info: jest.fn(),
    fatal: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    trace: jest.fn(),
    debug: jest.fn(),
  };
}

function randomString() {
  return `random_${Date.now()}_${Math.random()}`;
}

describe('createTypeOrmLogger', () => {
  const logger = mockLogger(), migrationLogger = mockLogger(), queryLogger = mockLogger();
  const ormLogger = createTypeOrmLogger(logger, migrationLogger, queryLogger);
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('log', () => {
    let message = randomString();
    ormLogger.log('info', message);
    expect(logger.info).toHaveBeenCalledWith(message);

    ormLogger.log('log', message);
    expect(logger.log).toHaveBeenCalledWith(message);

    ormLogger.log('warn', message);
    expect(logger.warn).toHaveBeenCalledWith(message);

    message = randomString();

    ormLogger.logSchemaBuild(message);
    expect(logger.info).lastCalledWith(message);
  });

  test('migration', () => {
    ormLogger.logMigration('migration');
    expect(migrationLogger.info).toHaveBeenCalledWith('migration');
  });

  test('query', () => {
    const param = [randomString()];
    const query = randomString();
    const errorInfo = randomString();
    ormLogger.logQuery(query, param);
    expect(queryLogger.debug).toHaveBeenCalledWith(expect.stringContaining(query), param);

    ormLogger.logQueryError(errorInfo, query, param);
    expect(queryLogger.error).toHaveBeenCalledWith(expect.stringContaining(errorInfo));
    expect(queryLogger.error).toHaveBeenCalledWith(expect.stringContaining(query));

    ormLogger.logQuerySlow(Math.random(), query);
    expect(queryLogger.warn).toHaveBeenCalled();
  });

});
