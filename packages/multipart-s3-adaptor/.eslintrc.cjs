module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: __dirname + "/tsconfig.json",
  },
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  overrides: [
    {
      files: ["**/*.test.ts", "**/*.spec.ts"],
      rules: {
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-use-before-define": "off"
      }
    }
  ],
  rules: {
    "@typescript-eslint/naming-convention": ["error",
      {
        selector: "default",
        format: ["camelCase"]
      },
      {
        selector: "variable",
        format: ["camelCase", "UPPER_CASE", "PascalCase"]
      },
      {
        selector: "function",
        format: ["camelCase", "UPPER_CASE", "PascalCase"]
      },
      {
        selector: "enumMember",
        format: ["UPPER_CASE"]
      },
      {
        selector: "parameter",
        format: ["camelCase"]
      },
      {
        selector: "memberLike",
        format: ["camelCase","PascalCase"],
        leadingUnderscore: "allow"
      },
      {
        selector: "memberLike",
        modifiers: ["static", "private"],
        format: ["camelCase", "PascalCase"],
        leadingUnderscore: "allow"
      },
      {
        selector: "typeLike",
        format: ["PascalCase"]
      }
    ]
  }
}
