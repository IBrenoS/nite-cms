import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals.map((config) => ({
    ...config,
    files: ["apps/{admin,api}/**/*.{js,jsx,ts,tsx}"],
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
  globalIgnores([
    "**/.next/**",
    "out/**",
    "**/build/**",
    "**/next-env.d.ts",
    "**/coverage/**",
    "**/test-results/**",
  ]),
]);

export default eslintConfig;
