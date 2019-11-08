module.exports = {
  collectCoverageFrom: ['packages/*/src/**/*.ts'],
  testRegex: './packages/[^/]+/tests/.+\\.ts$',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  coveragePathIgnorePatterns: ['/node_modules/', '/packages/*/lib'],
  modulePathIgnorePatterns: ['/test/fixtures/', '/test/tmp/', '/test/__data__/', '<rootDir>/build/'],
  moduleNameMapper: {
    '^@sensejs/([a-zA-Z0-9_-]+)$': '<rootDir>/packages/$1/',
  },
  setupFiles: ['./jest-setup.js'],
};
