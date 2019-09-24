module.exports = {
  roots: [
    '<rootDir>/tests'
  ],
  coveragePathIgnorePatterns: [
    '/tests/',
    '/node_modules/'
  ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node'
  ],
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      tsConfig: './tests/tsconfig.json'
    }
  }
};
