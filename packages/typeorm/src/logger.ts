import {Logger} from '@sensejs/core';
import {Logger as TypeOrmLogger} from 'typeorm';

export function createTypeOrmLogger(logger: Logger, migrationLogger: Logger, queryLogger: Logger): TypeOrmLogger {
  return {
    log(level: 'log' | 'info' | 'warn', message: any) {
      logger[level](message);
    },
    logMigration(message: string): any {
      migrationLogger.info(message);
    },
    logQuery(query: string, parameters: any[] = []) {
      queryLogger.debug('Query: ' + query + '\nParameters: ', parameters);
    },
    logQueryError(error: string, query: string, parameters: any[] = []) {
      queryLogger.error(
        'Error occurred when running query: \n' + query + '\nParameter: ' + parameters + '\nError detail: ' + error,
      );
    },
    logQuerySlow(time: number, query: string, parameters?: any[]) {
      queryLogger.warn(
        'The following query is too slow: \n' + query + '\nParameter: ' + parameters + 'Finished within %d ms',
        time,
      );
    },
    logSchemaBuild(message: string): any {
      logger.info(message);
    },
  };
}
