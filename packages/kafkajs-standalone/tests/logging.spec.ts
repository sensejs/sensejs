// tslint:disable:no-console
import '@sensejs/testing-utility/lib/mock-console';
import {createLogOption} from '../src/logging';
import {consoleLogger} from '@sensejs/utility';

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
    const opt = createLogOption(consoleLogger);

    for (const level of [1, 2, 3, 4, 5]) {
      opt.logCreator(0)(Object.assign({}, fixture, {level}));
    }

    // expect(console.log).not.toHaveBeenCalled();
    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  test('specified logger', () => {
    const opt = createLogOption(consoleLogger, {
      level: 'DEBUG',
    });

    for (const level of [0, 1, 2, 3, 4, 5]) {
      opt.logCreator(0)(Object.assign({}, fixture, {level}));
    }
    expect(console.info).toHaveBeenCalled();
    expect(console.debug).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });
});
