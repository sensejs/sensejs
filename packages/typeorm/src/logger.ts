import {Logger} from '@sensejs/core';
import {SilentLogger} from '@sensejs/utility';
import {EntityManager, Logger as TypeOrmLogger, QueryRunner} from 'typeorm';

export function createTypeOrmLogger(logger: Logger, migrationLogger: Logger): TypeOrmLogger {
  return {
    log(level: 'log' | 'info' | 'warn', message: any) {
      logger[level](message);
    },
    logMigration(message: string): any {
      migrationLogger.info(message);
    },
    logQuery(query: string, parameters?: any, queryRunner?: QueryRunner) {
      getLoggerFromQueryRunner(queryRunner).debug('Query: ' + query + '\nParameters: ', parameters);
    },
    logQueryError(error: string, query: string, parameters?: any, queryRunner?: QueryRunner) {
      getLoggerFromQueryRunner(queryRunner).error(
        'Error occurred when running query: \n' + query + '\nParameter: ' + parameters + '\nError detail: ' + error,
      );
    },
    logQuerySlow(time: number, query: string, parameters?: any, queryRunner?: QueryRunner) {
      getLoggerFromQueryRunner(queryRunner).warn(
        'The following query is too slow: \n' + query + '\nParameter: ' + parameters + 'Finished within %d ms',
        time,
      );
    },
    logSchemaBuild(message: string): any {
      logger.info(message);
    },
  };
}

export const loggerWeakMap = new WeakMap<EntityManager, Logger>();

const silentLogger = new SilentLogger();

function getLoggerFromQueryRunner(queryRunner?: QueryRunner): Logger {
  if (!queryRunner) {
    return silentLogger;
  }
  const loggerConfig = loggerWeakMap.get(queryRunner.manager);
  if (!loggerConfig) {
    return silentLogger;
  }
  return loggerConfig;
}

export function attachLoggerToEntityManager(entityManager: EntityManager, queryLogger: Logger) {
  loggerWeakMap.set(entityManager, queryLogger);
}
