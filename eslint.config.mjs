import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals.map((config) => ({
    ...config,
    files: ["apps/{web,admin}/**/*.{js,jsx,ts,tsx}"],
  })),
  ...nextTs,
  {
    files: ["apps/**/*.{js,jsx,ts,tsx}", "packages/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@nite/content/*/*"],
              message: "Use somente as entradas oficiais de @nite/content.",
            },
            {
              group: [
                "apps/*",
                "apps/**",
                "packages/*",
                "packages/**",
                "../apps/**",
                "../../apps/**",
                "../packages/**",
                "../../packages/**",
              ],
              message: "Não importe arquivos físicos entre workspaces.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/web/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@nite/content/admin"],
              message:
                "O portal público não pode importar contratos administrativos.",
            },
            {
              group: ["@nite/content/*/*"],
              message: "Use somente as entradas oficiais de @nite/content.",
            },
            {
              group: [
                "apps/*",
                "apps/**",
                "packages/*",
                "packages/**",
                "../apps/**",
                "../../apps/**",
                "../packages/**",
                "../../packages/**",
              ],
              message: "Não importe arquivos físicos entre workspaces.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    "**/.next/**",
    "out/**",
    "**/build/**",
    "**/next-env.d.ts",
    "**/coverage/**",
    "**/playwright-report/**",
    "**/test-results/**",
    ".codex_artifacts/**",
    ".codex-artifacts/**",
    "output/**",
  ]),
]);

export default eslintConfig;
