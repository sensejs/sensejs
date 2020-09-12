import {SilentLogger} from '@sensejs/utility';
import {LoggerBuilder} from '@sensejs/core';

class MockLoggerBuilder extends LoggerBuilder {
  build() {
    return new SilentLogger();
  }
}

export const loggerBuilder = new MockLoggerBuilder();
