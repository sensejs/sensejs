const performEndToEndTest = typeof process.env.END_TO_END_TEST === 'string';

const testRegex = performEndToEndTest
  ? './tests/.+\\.(e2e-)?(test|spec).ts$'
  : './tests/.+\\.(test|spec).ts$';

module.exports = {
  collectCoverageFrom: ['./src/**/*.ts'],
  testRegex,
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  coveragePathIgnorePatterns: ['/node_modules/', '/packages/*/lib'],
  setupFiles: [__dirname+'/jest-setup.js'],
  resetMocks: true,
  restoreMocks: true,
  globals: {
    'ts-jest': {
      packageJson: '<rootDir>/package.json',
      tsConfig: '<rootDir>/tests/tsconfig.json',
      diagnostics: 'pretty'
    },
  },
};
