import {
  BasicTextLogTransformer,
  ColorTtyTextLogTransformer,
  LoggerFactory,
  LogLevel,
  LogTransformer,
  PlainTextLogTransformer,
  RawLogData,
  StreamLogTransport,
} from '../src';
import {Writable} from 'stream';

class MockLogTransport extends StreamLogTransport {
  constructor() {
    super(
      new Writable({
        write(content, encoding, callback) {
          return callback(null);
        },
      }),
      [],
    );
  }
}

describe('Logger', () => {
  test('Logger usage', () => {
    const mockLogTransport = new MockLogTransport();
    const writeSpy = jest.spyOn(mockLogTransport, 'write');

    const loggerFactory = new LoggerFactory('', [mockLogTransport]).setModuleName('foo');
    let logger = loggerFactory.build();

    const assertTransportLogLevelParams = (level: LogLevel) => {
      expect(writeSpy).lastCalledWith(
        expect.objectContaining(
          Object.assign(
            {
              timestamp: expect.any(Number),
              module: 'foo',
              traceId: '',
            },
            {level},
          ),
        ),
      );
    };

    logger.debug('...');
    assertTransportLogLevelParams(LogLevel.DEBUG);
    logger.trace('...');
    assertTransportLogLevelParams(LogLevel.TRACE);
    logger.info('...');
    assertTransportLogLevelParams(LogLevel.INFO);
    logger.warn('...');
    assertTransportLogLevelParams(LogLevel.WARN);
    logger.error('...');
    assertTransportLogLevelParams(LogLevel.ERROR);
    logger.fatal('...');
    assertTransportLogLevelParams(LogLevel.FATAL);

    const assertTransportModuleAndTranceID = (module: string, traceId: string) => {
      expect(writeSpy).lastCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Number),
          module,
          traceId,
        }),
      );
    };
    // Change module name
    let newModuleName = `module_${Date.now()}`;
    logger = logger(newModuleName);
    logger.log('...');
    assertTransportModuleAndTranceID(newModuleName, '');
    // Change trace id
    let newTraceId = `trace_${Date.now()}`;
    logger = logger(null, newTraceId);
    logger.log('...');
    // Change module name with trace id preserved
    assertTransportModuleAndTranceID(newModuleName, newTraceId);
    newModuleName = `module_${Date.now()}`;
    logger = logger(newModuleName);
    logger.log('...');
    assertTransportModuleAndTranceID(newModuleName, newTraceId);

    // Change both module name and trace id
    newTraceId = `trace_${Date.now()}`;
    newModuleName = `module_${Date.now()}`;
    logger = logger(newModuleName, newTraceId);
    logger.log('...');
    assertTransportModuleAndTranceID(newModuleName, newTraceId);

    // Invalid module name
    expect(() => logger('*')).toThrow();

    // Invalid trace id
    expect(() => logger(null, '*')).toThrow();
  });

  test('Plain text transformer', () => {
    const transformer = new PlainTextLogTransformer();
    const regexp = /^\+\s+([^ ]+)\s+(\w+)\s+(\<[^ >]+\>|-)\s+(\{[^ }]+\}|-)\s+\| .+/;
    for (const level of Object.values(LogLevel)) {
      if (typeof level !== 'number') {
        continue;
      }
      for (const module of ['', 'module']) {
        for (const traceId of ['', 'traceId']) {
          expect(
            transformer
              .format({
                timestamp: Date.now(),
                level,
                module,
                traceId,
                messages: ['message'],
              })
              .toString(),
          ).toMatch(regexp);
        }
      }
    }
  });

  test('Color text transformer', () => {
    const transformer = new ColorTtyTextLogTransformer();

    for (const level of Object.values(LogLevel)) {
      if (typeof level !== 'number') {
        continue;
      }
      for (const module of ['', 'module']) {
        for (const traceId of ['', 'traceId']) {
          transformer
            .format({
              timestamp: Date.now(),
              level,
              module,
              traceId,
              messages: ['message'],
            })
            .toString();
        }
      }
    }
  });

  describe('StreamLogTransport', () => {
    test('log level filter', async () => {
      const levels = [LogLevel.FATAL, LogLevel.ERROR, LogLevel.WARN];
      const mockWriter = jest.fn((chunk, encoding, callback) => {
        return callback();
      });
      const mockOutput = new Writable({
        write: mockWriter,
      });
      Object.defineProperty(mockOutput, 'isTty', {value: true});
      const transport = new StreamLogTransport(mockOutput, levels);
      await transport.write({
        timestamp: Date.now(),
        level: LogLevel.DEBUG,
        module: '',
        traceId: '',
        messages: ['message'],
      });
      expect(mockWriter).not.toHaveBeenCalled();
      await transport.write({
        timestamp: Date.now(),
        level: LogLevel.ERROR,
        module: '',
        traceId: '',
        messages: ['message'],
      });
      expect(mockWriter).toHaveBeenCalled();
    });

    test('streaming', async () => {
      const levels = [LogLevel.ERROR];
      const bufferedCallback: ((e?: Error) => void)[] = [];
      const mockWriter = jest.fn((chunk, encoding, callback) => {
        bufferedCallback.push(callback);
      });
      const mockOutput = new Writable({
        highWaterMark: 1,
        write: mockWriter,
      });
      const transport = new StreamLogTransport(mockOutput, levels);
      const p1 = transport.write({
        timestamp: Date.now(),
        level: LogLevel.ERROR,
        module: '',
        traceId: '',
        messages: ['1'],
      });
      expect(mockWriter).toHaveBeenCalledTimes(1);

      const p2 = transport.write({
        timestamp: Date.now(),
        level: LogLevel.ERROR,
        module: '',
        traceId: '',
        messages: ['message'],
      });
      expect(mockWriter).toHaveBeenCalledTimes(1);
      bufferedCallback.shift()!();
      await p1;
      bufferedCallback.shift()!();
      await p2;
    });
  });
});
