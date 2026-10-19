import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import { reactRefresh } from "eslint-plugin-react-refresh";

export default [
  {
    ignores: ["dist/**", "dist-web/**", "artifacts/**", "coverage/**", "node_modules/**", "output/**", ".playwright-cli/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh.plugin,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    files: ["extension/**/*.js"],
    languageOptions: {
      globals: {
        chrome: "readonly",
      },
    },
  },
  {
    files: ["*.config.js", "scripts/**/*.mjs", "tests/**/*.js"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["tests/browser/**/*.js"],
    languageOptions: { globals: { ...globals.browser, ...globals.node, chrome: "readonly" } },
  },
];
