const path = require('path');
const performEndToEndTest = typeof process.env.END_TO_END_TEST === 'string';

const testRegex = performEndToEndTest
  ? './tests/.+\\.(e2e-)?(test|spec).ts$'
  : './tests/.+\\.(test|spec).ts$';

module.exports = {
  testRegex,
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.test.json',
      diagnostics: 'pretty',
      useESM: true
    }],
  },
  extensionsToTreatAsEsm: ['.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '/packages/*/lib'],
  setupFiles: [__dirname+'/jest-setup.cjs'],
  resetMocks: true,
  resolver: 'jest-ts-webcompat-resolver',
  restoreMocks: true,
};
