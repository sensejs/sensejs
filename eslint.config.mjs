import js from '@eslint/js';
import ts from 'typescript-eslint';

const rules = {
  '@typescript-eslint/await-thenable': 'off',
  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/no-unsafe-function-type': 'off',
  '@typescript-eslint/no-empty-object-type': 'off',
  '@typescript-eslint/ban-ts-comment': 'off',

  '@typescript-eslint/no-non-null-assertion': 'error',
  '@typescript-eslint/one-variable-per-declaration': 'off',
  '@typescript-eslint/object-literal-sort-keys': 'off',
  '@typescript-eslint/trailing-comma': 'off',
  '@typescript-eslint/callable-types': 'off',
  '@typescript-eslint/max-classes-per-file': 'off',
  '@typescript-eslint/no-empty-function': 'off',
  '@typescript-eslint/no-unnecessary-initializer': ['off'],
  '@typescript-eslint/member-ordering': [
    'error',
    {
      default: [
        // Index signature

        // Fields
        'static-field', // = ['public-static-field', 'protected-static-field', 'private-static-field'])
        'abstract-field', // = ['public-abstract-field', 'protected-abstract-field', 'private-abstract-field'])
        'instance-field', // = ['public-instance-field', 'protected-instance-field', 'private-instance-field'])

        // Constructors
        'constructor', // = ['public-constructor', 'protected-constructor', 'private-constructor'])

        // Methods
        'static-method', // = ['public-static-method', 'protected-static-method', 'private-static-method'])
        'abstract-method', // = ['public-abstract-method', 'protected-abstract-method', 'private-abstract-method'])
        'instance-method', // = ['public-instance-method', 'protected-instance-method', 'private-instance-method'])
      ],
    },
  ],
  // no-use-before-define seems to be buggy,
  '@typescript-eslint/no-use-before-define': [
    'warn',
    {
      functions: false,
    },
  ],
  '@typescript-eslint/member-access': 'off',
  '@typescript-eslint/default-param-last': ['error'],
  '@typescript-eslint/array-type': ['error'],
  '@typescript-eslint/interface-name': 'off',
  '@typescript-eslint/explicit-function-return-type': 'off',
  '@typescript-eslint/no-unused-vars': 'off',
  '@typescript-eslint/naming-convention': [
    'error',
    {
      selector: 'default',
      format: ['camelCase'],
    },
    {
      selector: 'variable',
      format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
    },
    {
      selector: 'function',
      format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
    },
    {
      selector: 'enumMember',
      format: ['UPPER_CASE'],
    },
    {
      selector: 'parameter',
      format: ['camelCase'],
    },
    {
      selector: 'memberLike',
      modifiers: ['private'],
      format: ['camelCase'],
      leadingUnderscore: 'allow',
    },
    {
      selector: 'memberLike',
      modifiers: ['static', 'private'],
      format: ['camelCase', 'PascalCase'],
      leadingUnderscore: 'allow',
    },
    {
      selector: 'typeLike',
      format: ['PascalCase'],
    },
    {
      selector: 'import',
      format: ['camelCase', 'PascalCase'],
      leadingUnderscore: 'allow',
    },
    {
      selector: 'objectLiteralProperty',
      format: ['camelCase', 'PascalCase', 'snake_case'],
      leadingUnderscore: 'allow',
    },
  ],
};

export default ts.config(
  {
    ignores: [
      'node_modules',
      'dist-cjs',
      'dist-esm',
      'lib',
      '**/*.d.ts',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
      '**/coverage/**/*',
      'website/**/*',
      '**/*.json',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
  },
  js.configs.recommended,
  ts.configs.recommended,
  {
    // plugins: {
    //   '@typescript-eslint': ts.plugin,
    // },
    languageOptions: {
      parser: ts.parser,
      parserOptions: {
        project: ['tsconfig.test.json', 'tsconfig.baseline.json', 'tsconig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules,
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/*.e2e-spec.ts', '**/*.e2e-test.ts'],
    languageOptions: {
      parser: ts.parser,
      parserOptions: {
        project: ['tsconfig.test.json', 'tsconfig.baseline.json', 'tsconig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...rules,
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  // {
  //   // disable type-aware linting on JS files
  //   files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
  //   extends: [js.configs.recommended],
  //   rules: {
  //     'no-undef': 'off',
  //   },
  // },
);
