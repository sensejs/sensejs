import {ColorTtyTextLogTransformer, LoggerFactory, LogLevel, PlainTextLogTransformer, StreamLogTransport} from '../src';
import {Writable} from 'stream';

class MockLogTransport extends StreamLogTransport {
    constructor() {
        super(new Writable({
            write(content, encoding, callback) {
                return callback(null);
            }
        }), []);
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
                expect.objectContaining(Object.assign({
                    timestamp: expect.any(Number),
                    module: 'foo',
                    traceId: '',
                }, {level}))
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
                })
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

    });


    test('Plain text transformer', () => {
        const transformer = new PlainTextLogTransformer();
        const regexp = /^\+ ([^ ]+) (\w+) (\<[^ >]+\>|-) (\{[^ }]+\}|-) \| .+/;
        expect(transformer.format({
            level: LogLevel.TRACE,
            timestamp: Date.now(),
            module: 'module',
            traceId: 'traceId',
            messages: ['message']
        }).toString()).toMatch(regexp);
        expect(transformer.format({
            level: LogLevel.TRACE,
            timestamp: Date.now(),
            module: '',
            traceId: 'traceId',
            messages: ['message']
        }).toString()).toMatch(regexp);
        expect(transformer.format({
            level: LogLevel.TRACE,
            timestamp: Date.now(),
            module: 'module',
            traceId: '',
            messages: ['message']
        }).toString()).toMatch(regexp);

    });

    test('Color text transformer', () => {
        const transformer = new ColorTtyTextLogTransformer();
        transformer.format({
            level: LogLevel.TRACE,
            timestamp: Date.now(),
            module: 'module',
            traceId: 'traceId',
            messages: ['message']
        }).toString();
        transformer.format({
            level: LogLevel.TRACE,
            timestamp: Date.now(),
            module: '',
            traceId: 'traceId',
            messages: ['message']
        }).toString();

        transformer.format({
            level: LogLevel.TRACE,
            timestamp: Date.now(),
            module: 'module',
            traceId: '',
            messages: ['message']
        }).toString();
    });

});
