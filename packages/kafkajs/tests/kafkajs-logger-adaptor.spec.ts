// tslint:disable:no-console
import '@sensejs/testing-utility/lib/mock-console';
import {createLogOption} from '../src/kafkajs-logger-adaptor';
import {SenseLoggerBuilder} from '@sensejs/logger';

const fixture = {
  log: {
    message: 'message',
    timestamp: new Date(),
    label: 'label',
  },
  level: 0,
  label: 'label',
  namespace: 'foo',
};
describe('createLogOption', () => {
  test('default', () => {
    const opt = createLogOption();

    for (const level of [0, 1, 2, 3, 4, 5]) {
      opt.logCreator(0)(Object.assign({}, fixture, {level}));
    }

    expect(console.log).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
    expect(console.debug).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test('specified logger', () => {
    const loggerBuilder = new SenseLoggerBuilder('', '', []);
    const opt = createLogOption({
      level: 'DEBUG',
      loggerBuilder,
      labelPrefix: 'KafkaJS'
    });

    for (const level of [0, 1, 2, 3, 4, 5]) {
      opt.logCreator(0)(Object.assign({}, fixture, {level}));
    }
  });
});
