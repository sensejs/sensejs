module.exports = {
  projects: ['packages/*/jest.config.js'],
};

// const testRegex = performEndToEndTest
//   ? './packages/[^/]+/tests/.+\\.(e2e-)?(test|spec).ts$'
//   : './packages/[^/]+/tests/.+\\.(test|spec).ts$';
//
// module.exports = {
//   collectCoverageFrom: ['packages/*/src/**/*.ts'],
//   testRegex,
//   testEnvironment: 'node',
//   transform: {
//     '^.+\\.tsx?$': 'ts-jest',
//   },
//   coveragePathIgnorePatterns: ['/node_modules/', '/packages/*/lib'],
//   modulePathIgnorePatterns: ['/test/fixtures/', '/test/tmp/', '/test/__data__/', '<rootDir>/build/'],
//   moduleNameMapper: {
//     '^@sensejs/([a-zA-Z0-9_-]+)$': '<rootDir>/packages/$1/',
//   },
//   setupFiles: ['./jest-setup.js'],
//   resetMocks: true,
//   restoreMocks: true,
//   globals: {
//     'ts-jest': {
//       tsConfig: 'tsconfig.test.json',
//     },
//   },
// };
