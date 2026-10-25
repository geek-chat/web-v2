import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Buttons and form controls come from src/components/ui, which carries the
    // shared look, focus ring and type="button" default (.claude/RULES.md R7).
    files: ["src/**/*.tsx"],
    ignores: ["src/components/ui/**", "src/**/*.test.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name=/^(button|input|select|textarea)$/]",
          message:
            "Use the ui primitives (Button, ButtonBase, Input, Select, Textarea in src/components/ui) instead of a raw element.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
